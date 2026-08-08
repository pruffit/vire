import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadTrack, planDownload, chunk, backfillCovers, OFFLINE_CACHE, estimateUsage, requestPersistence, type DownloadMeta } from './download';
import { getTrack, putTrack, deleteTrack } from './db';

const TRACK_ID = 't1';
const MANIFEST_URL = `/api/v1/tracks/${TRACK_ID}/manifest`;
const HLS_URL = 'https://s3.example/vault/tracks/t1/hls/index.m3u8';
const COVER_URL = 'https://s3.example/covers/t1.jpg';
// Качается не оригинал, а оптимизированное превью (см. coverPreviewUrl).
const COVER_FETCH_URL = `/_next/image?url=${encodeURIComponent(COVER_URL)}&w=640&q=75`;
// 8 сегментов => 2 пачки при concurrency=4 (см. download.ts) — нужно для теста прогресса/abort.
const SEGMENT_URLS = Array.from({ length: 8 }, (_, i) => `https://s3.example/vault/tracks/t1/hls/chunk_00${i}.ts`);
const PLAYLIST_TEXT = ['#EXTM3U', ...SEGMENT_URLS.map((_, i) => `chunk_00${i}.ts`)].join('\n');
const MANIFEST_JSON = JSON.stringify({ hlsUrl: HLS_URL });

const META: DownloadMeta = {
  id: TRACK_ID,
  title: 'Трек',
  artistName: 'Артист',
  coverUrl: COVER_URL,
  artistSlug: 'artist',
  releaseId: 'rel-1',
  isExplicit: false,
  version: null,
  durationSec: 180,
};

function fakeResponse(body: string, ok = true): Response {
  const buf = new TextEncoder().encode(body).buffer;
  const res = {
    ok,
    status: ok ? 200 : 500,
    async arrayBuffer() {
      return buf;
    },
    async blob() {
      return new Blob([body]);
    },
    clone() {
      return fakeResponse(body, ok);
    },
  };
  return res as unknown as Response;
}

function fakeCache() {
  const store = new Map<string, unknown>();
  return {
    async match(req: string) {
      return store.get(req);
    },
    async put(req: string, res: unknown) {
      store.set(req, res);
    },
    async delete(req: string) {
      return store.delete(req);
    },
    async keys() {
      return [...store.keys()].map((url) => ({ url }));
    },
    _store: store,
  };
}

function fakeCacheStorage() {
  const caches = new Map<string, ReturnType<typeof fakeCache>>();
  return {
    async open(name: string) {
      if (!caches.has(name)) caches.set(name, fakeCache());
      return caches.get(name)!;
    },
    async keys() {
      return [...caches.keys()];
    },
    async delete(name: string) {
      return caches.delete(name);
    },
  };
}

function makeFetch(overrides: Record<string, () => Response | Promise<Response>> = {}) {
  return vi.fn(async (url: string, init?: { signal?: AbortSignal }) => {
    if (init?.signal?.aborted) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
    if (overrides[url]) return overrides[url]();
    if (url === MANIFEST_URL) return fakeResponse(MANIFEST_JSON);
    if (url === HLS_URL) return fakeResponse(PLAYLIST_TEXT);
    if (url === COVER_FETCH_URL) return fakeResponse('cover-bytes');
    if (url.endsWith('.ts')) return fakeResponse('segment-bytes');
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe('planDownload', () => {
  it('ничего не скачано — все сегменты в план', () => {
    expect(planDownload(['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c']);
  });

  it('скачано частично — в плане только недостающее', () => {
    expect(planDownload(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
  });

  it('всё скачано — план пуст', () => {
    expect(planDownload(['a', 'b'], ['a', 'b'])).toEqual([]);
  });
});

describe('chunk', () => {
  it('делит на пачки заданного размера', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('пустой массив даёт пустой список пачек', () => {
    expect(chunk([], 4)).toEqual([]);
  });

  it('размер пачки больше длины массива — одна пачка', () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });
});

describe('downloadTrack', () => {
  beforeEach(() => {
    vi.stubGlobal('caches', fakeCacheStorage());
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await deleteTrack(TRACK_ID);
  });

  it('успешный путь: манифест → плейлист → все сегменты → обложка, статус done', async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
    const onProgress = vi.fn();

    const track = await downloadTrack(META, { onProgress });

    expect(track.status).toBe('done');
    expect(track.hlsUrl).toBe(HLS_URL);
    expect(track.segmentUrls).toEqual(SEGMENT_URLS);
    expect(track.bytes).toBeGreaterThan(0);
    expect(onProgress).toHaveBeenCalledWith(8, 8);

    const cache = await (globalThis as unknown as { caches: ReturnType<typeof fakeCacheStorage> }).caches.open(OFFLINE_CACHE);
    expect(await cache.match(MANIFEST_URL)).toBeDefined();
    expect(await cache.match(HLS_URL)).toBeDefined();
    for (const url of SEGMENT_URLS) expect(await cache.match(url)).toBeDefined();

    const persisted = await getTrack(TRACK_ID);
    expect(persisted?.status).toBe('done');
    // Обложка на чужом origin: SW её не перехватывает, поэтому копия живёт в IndexedDB.
    expect(persisted?.coverBlob).toBeInstanceOf(Blob);
    expect(persisted?.coverBlob?.size).toBeGreaterThan(0);
  });

  it('повторная загрузка не перекачивает уже сохранённую обложку', async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
    await downloadTrack(META);

    const coverCallsFirst = fetchMock.mock.calls.filter(([url]) => url === COVER_FETCH_URL).length;
    expect(coverCallsFirst).toBe(1);

    await downloadTrack(META);
    const coverCallsTotal = fetchMock.mock.calls.filter(([url]) => url === COVER_FETCH_URL).length;
    expect(coverCallsTotal).toBe(1);
  });

  it('обрыв по signal во время загрузки сегментов даёт partial, не бросает ошибку', async () => {
    const controller = new AbortController();
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);

    const progressCalls: Array<[number, number]> = [];
    const onProgress = vi.fn((done: number, total: number) => {
      progressCalls.push([done, total]);
      if (done === 4) controller.abort();
    });

    const track = await downloadTrack(META, { signal: controller.signal, onProgress });

    expect(track.status).toBe('partial');
    expect(track.segmentUrls).toEqual(SEGMENT_URLS);
    expect(progressCalls.some(([done]) => done === 4)).toBe(true);
    expect(progressCalls.every(([done]) => done <= 4)).toBe(true);

    const persisted = await getTrack(TRACK_ID);
    expect(persisted?.status).toBe('partial');
  });

  it('докачивает только недостающие сегменты у partial-записи, но манифест и плейлист перезапрашивает', async () => {
    const alreadyCached = SEGMENT_URLS.slice(0, 4);
    const missing = SEGMENT_URLS.slice(4);

    const cacheStorage = fakeCacheStorage();
    vi.stubGlobal('caches', cacheStorage);
    const cache = await cacheStorage.open(OFFLINE_CACHE);
    for (const url of alreadyCached) await cache.put(url, fakeResponse('segment-bytes'));

    await putTrack({
      ...META,
      hlsUrl: HLS_URL,
      segmentUrls: SEGMENT_URLS,
      bytes: 400,
      addedAt: 1000,
      status: 'partial',
    });

    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);

    const track = await downloadTrack(META, {});

    expect(track.status).toBe('done');
    expect(track.addedAt).toBe(1000);
    for (const url of missing) {
      expect(fetchMock).toHaveBeenCalledWith(url, expect.anything());
    }
    for (const url of alreadyCached) {
      expect(fetchMock).not.toHaveBeenCalledWith(url, expect.anything());
    }
    expect(fetchMock).toHaveBeenCalledWith(MANIFEST_URL, expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(HLS_URL, expect.anything());
  });

  it('плейлист на сервере изменился (пере-транскод) — старые сегменты не мешают, новые докачиваются', async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
    await downloadTrack(META, {});

    const NEW_SEGMENT_URLS = Array.from({ length: 5 }, (_, i) => `https://s3.example/vault/tracks/t1/hls/new_${i}.ts`);
    const NEW_PLAYLIST_TEXT = ['#EXTM3U', ...NEW_SEGMENT_URLS.map((_, i) => `new_${i}.ts`)].join('\n');
    const fetchMock2 = makeFetch({ [HLS_URL]: () => fakeResponse(NEW_PLAYLIST_TEXT) });
    vi.stubGlobal('fetch', fetchMock2);

    const track = await downloadTrack(META, {});

    expect(track.status).toBe('done');
    expect(track.segmentUrls).toEqual(NEW_SEGMENT_URLS);
    for (const url of NEW_SEGMENT_URLS) {
      expect(fetchMock2).toHaveBeenCalledWith(url, expect.anything());
    }
    for (const url of SEGMENT_URLS) {
      expect(fetchMock2).not.toHaveBeenCalledWith(url, expect.anything());
    }
  });

  it('сеть недоступна при повторной попытке — доигрывает с уже известным списком сегментов', async () => {
    await putTrack({
      ...META,
      hlsUrl: HLS_URL,
      segmentUrls: SEGMENT_URLS,
      bytes: 400,
      addedAt: 1000,
      status: 'partial',
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const track = await downloadTrack(META, {});

    expect(track.status).toBe('partial');
    expect(track.hlsUrl).toBe(HLS_URL);
    expect(track.segmentUrls).toEqual(SEGMENT_URLS);
  });

  it('размер сегмента берётся из Content-Length без чтения тела в память', async () => {
    const segmentUrl = SEGMENT_URLS[0];
    const arrayBufferSpy = vi.fn(async () => new TextEncoder().encode('segment-bytes').buffer);
    const fetchMock = makeFetch({
      [segmentUrl]: () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '999' }),
        arrayBuffer: arrayBufferSpy,
        clone() {
          return this;
        },
      }) as unknown as Response,
    });
    vi.stubGlobal('fetch', fetchMock);

    const track = await downloadTrack(META, {});

    expect(track.status).toBe('done');
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it('сбой загрузки обложки не мешает статусу done', async () => {
    const fetchMock = makeFetch({
      [COVER_FETCH_URL]: () => fakeResponse('', false),
    });
    vi.stubGlobal('fetch', fetchMock);

    const track = await downloadTrack(META, {});
    expect(track.status).toBe('done');
  });
});

describe('estimateUsage / requestPersistence без navigator.storage', () => {
  it('estimateUsage деградирует до нулей', async () => {
    expect(await estimateUsage()).toEqual({ usage: 0, quota: 0 });
  });

  it('requestPersistence деградирует до false', async () => {
    expect(await requestPersistence()).toBe(false);
  });
});

describe('backfillCovers', () => {
  const stale = {
    id: 'old', title: 'T', artistName: 'A', coverUrl: COVER_URL,
    hlsUrl: HLS_URL, segmentUrls: [], bytes: 100, addedAt: 1, status: 'done' as const,
  };

  afterEach(async () => {
    vi.unstubAllGlobals();
    await deleteTrack('old');
  });

  it('качает превью записям без обложки и сохраняет его в IndexedDB', async () => {
    vi.stubGlobal('caches', fakeCacheStorage());
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);

    const updated = await backfillCovers([stale]);

    expect(updated).toHaveLength(1);
    expect(updated[0].coverBlob).toBeInstanceOf(Blob);
    expect(fetchMock).toHaveBeenCalledWith(COVER_FETCH_URL);
    expect((await getTrack('old'))?.coverBlob).toBeInstanceOf(Blob);
  });

  it('старую копию обложки убирает из кэша и пересчитывает bytes на превью', async () => {
    const cacheStorage = fakeCacheStorage();
    vi.stubGlobal('caches', cacheStorage);
    const cache = await cacheStorage.open(OFFLINE_CACHE);
    // «оригинал» прошлых версий: 40 байт тела, они уже сидят в bytes записи
    await cache.put(COVER_URL, fakeResponse('x'.repeat(40)));
    vi.stubGlobal('fetch', makeFetch());

    const [updated] = await backfillCovers([{ ...stale, bytes: 140 }]);

    expect(await cache.match(COVER_URL)).toBeUndefined();
    expect(updated.bytes).toBe(140 - 40 + updated.coverBlob!.size);
  });

  it('записи с обложкой и без coverUrl не трогает — в сеть не ходит', async () => {
    vi.stubGlobal('caches', fakeCacheStorage());
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);

    const updated = await backfillCovers([
      { ...stale, coverBlob: new Blob(['x']) },
      { ...stale, id: 'nocover', coverUrl: null },
    ]);

    expect(updated).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('нет сети — тихо возвращает пусто, запись не портит', async () => {
    vi.stubGlobal('caches', fakeCacheStorage());
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    await expect(backfillCovers([stale])).resolves.toEqual([]);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/offline/download', () => ({
  downloadTrack: vi.fn(),
  removeDownload: vi.fn(),
  cachedSegmentKeys: vi.fn().mockResolvedValue([]),
  planDownload: (segmentUrls: string[], cachedUrls: string[]) => {
    const cached = new Set(cachedUrls);
    return segmentUrls.filter((url) => !cached.has(url));
  },
}));
vi.mock('@/lib/offline/db', () => ({ getAllTracks: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { downloadTrack, removeDownload, cachedSegmentKeys, type DownloadMeta, type DownloadOptions } from '@/lib/offline/download';
import { getAllTracks, type OfflineTrack } from '@/lib/offline/db';
import { toast } from '@/lib/toast';
import { useOfflineStore } from './offline';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const META: DownloadMeta = { id: 't1', title: 'Track', artistName: 'Artist', coverUrl: null };

function fakeTrack(status: OfflineTrack['status'], segCount = 2): OfflineTrack {
  return {
    id: 't1',
    title: 'Track',
    artistName: 'Artist',
    coverUrl: null,
    hlsUrl: 'https://example.com/index.m3u8',
    segmentUrls: Array.from({ length: segCount }, (_, i) => `seg${i}`),
    bytes: 100,
    addedAt: Date.now(),
    status,
  };
}

describe('useOfflineStore', () => {
  beforeEach(() => {
    useOfflineStore.setState({ entries: new Map(), hydrated: false });
    vi.mocked(downloadTrack).mockReset();
    vi.mocked(removeDownload).mockReset();
    vi.mocked(getAllTracks).mockReset();
    vi.mocked(toast.error).mockClear();
    vi.mocked(cachedSegmentKeys).mockReset().mockResolvedValue([]);
  });

  it('второй download() по тому же треку, пока первый в полёте, не запускает второй downloadTrack', async () => {
    const { promise, resolve } = deferred<OfflineTrack>();
    vi.mocked(downloadTrack).mockReturnValue(promise);

    useOfflineStore.getState().download(META);
    useOfflineStore.getState().download(META);

    expect(downloadTrack).toHaveBeenCalledTimes(1);
    expect(useOfflineStore.getState().entries.get('t1')?.status).toBe('downloading');

    resolve(fakeTrack('done'));
    await promise;
  });

  it('download() — no-op, если трек уже done', () => {
    useOfflineStore.setState({ entries: new Map([['t1', { status: 'done', done: 2, total: 2 }]]) });
    useOfflineStore.getState().download(META);
    expect(downloadTrack).not.toHaveBeenCalled();
  });

  it('успешная загрузка переводит запись в done с done/total по числу сегментов', async () => {
    vi.mocked(downloadTrack).mockResolvedValue(fakeTrack('done', 3));

    useOfflineStore.getState().download(META);
    await vi.waitFor(() => {
      expect(useOfflineStore.getState().entries.get('t1')).toEqual({ status: 'done', done: 3, total: 3 });
    });
  });

  it('onProgress из downloadTrack обновляет entries до завершения', async () => {
    const { promise, resolve } = deferred<OfflineTrack>();
    vi.mocked(downloadTrack).mockImplementation((_meta: DownloadMeta, options?: DownloadOptions) => {
      options?.onProgress?.(1, 4);
      return promise;
    });

    useOfflineStore.getState().download(META);
    expect(useOfflineStore.getState().entries.get('t1')).toEqual({ status: 'downloading', done: 1, total: 4 });

    resolve(fakeTrack('done', 4));
    await promise;
  });

  it('partial без отмены показывает тост об ошибке', async () => {
    vi.mocked(downloadTrack).mockResolvedValue(fakeTrack('partial', 1));

    useOfflineStore.getState().download(META);
    await vi.waitFor(() => {
      expect(useOfflineStore.getState().entries.get('t1')?.status).toBe('partial');
    });
    expect(toast.error).toHaveBeenCalledWith('Не удалось скачать трек офлайн');
  });

  it('cancel() отменяет signal, переданный в downloadTrack; partial после отмены — без тоста', async () => {
    let capturedSignal: AbortSignal | undefined;
    const { promise, resolve } = deferred<OfflineTrack>();
    vi.mocked(downloadTrack).mockImplementation((_meta: DownloadMeta, options?: DownloadOptions) => {
      capturedSignal = options?.signal;
      return promise;
    });

    useOfflineStore.getState().download(META);
    useOfflineStore.getState().cancel('t1');

    expect(capturedSignal?.aborted).toBe(true);

    resolve(fakeTrack('partial', 0));
    await vi.waitFor(() => {
      expect(useOfflineStore.getState().entries.get('t1')?.status).toBe('partial');
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('remove() снимает запись и переводит статус в idle', async () => {
    useOfflineStore.setState({ entries: new Map([['t1', { status: 'done', done: 2, total: 2 }]]) });
    vi.mocked(removeDownload).mockResolvedValue(undefined);

    useOfflineStore.getState().remove('t1');

    await vi.waitFor(() => {
      expect(useOfflineStore.getState().entries.get('t1')).toEqual({ status: 'idle', done: 0, total: 0 });
    });
    expect(removeDownload).toHaveBeenCalledWith('t1');
  });

  it('hydrate() заполняет entries из IndexedDB и выполняется один раз', async () => {
    vi.mocked(getAllTracks).mockResolvedValue([fakeTrack('done', 2), fakeTrack('partial', 1)].map((t, i) => ({ ...t, id: `t${i}` })));

    await useOfflineStore.getState().hydrate();
    expect(useOfflineStore.getState().entries.get('t0')).toEqual({ status: 'done', done: 2, total: 2 });
    // partial без совпадений в кэше (cachedSegmentKeys мокнут на []) — честно 0, а не total.
    expect(useOfflineStore.getState().entries.get('t1')).toEqual({ status: 'partial', done: 0, total: 1 });

    await useOfflineStore.getState().hydrate();
    expect(getAllTracks).toHaveBeenCalledTimes(1);
  });

  it('hydrate() считает done для partial по факту наличия сегментов в кэше, не total', async () => {
    const track = fakeTrack('partial', 3);
    track.segmentUrls = ['seg0', 'seg1', 'seg2'];
    vi.mocked(getAllTracks).mockResolvedValue([track]);
    vi.mocked(cachedSegmentKeys).mockResolvedValue(['seg1']);

    await useOfflineStore.getState().hydrate();

    expect(useOfflineStore.getState().entries.get('t1')).toEqual({ status: 'partial', done: 1, total: 3 });
  });

  it('hydrate() не затирает запись, у которой уже идёт активная загрузка', async () => {
    useOfflineStore.setState({
      entries: new Map([['t1', { status: 'downloading', done: 2, total: 5 }]]),
      hydrated: false,
    });
    vi.mocked(getAllTracks).mockResolvedValue([fakeTrack('partial', 5)]);

    await useOfflineStore.getState().hydrate();

    expect(useOfflineStore.getState().entries.get('t1')).toEqual({ status: 'downloading', done: 2, total: 5 });
  });
});

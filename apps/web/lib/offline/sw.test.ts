import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type SwRequest = { url: string; method: string; mode?: string; destination?: string };
type SwTestExports = {
  strategyFor: (url: URL, request: SwRequest) => string;
  trimCache: (cache: ReturnType<typeof fakeCache>, limit: number) => Promise<void>;
};
type FakeSelf = {
  addEventListener: (type: string, fn: (event: unknown) => unknown) => void;
  skipWaiting: () => void;
  clients: { claim: () => void; matchAll: () => Promise<unknown[]> };
  registration: { showNotification: (...args: unknown[]) => void };
  __test?: SwTestExports;
};

function fakeCache() {
  const store = new Map<string, unknown>();
  return {
    async match(req: string | { url: string }) {
      return store.get(typeof req === 'string' ? req : req.url);
    },
    async put(req: string | { url: string }, res: unknown) {
      store.set(typeof req === 'string' ? req : req.url, res);
    },
    async delete(req: string | { url: string }) {
      return store.delete(typeof req === 'string' ? req : req.url);
    },
    async keys() {
      return [...store.keys()].map((url) => ({ url }));
    },
    async addAll(urls: string[]) {
      for (const u of urls) store.set(u, { url: u, ok: true });
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
    _all: caches,
  };
}

async function loadSw() {
  vi.resetModules();
  const listeners: Record<string, (event: unknown) => unknown> = {};
  const fakeSelf: FakeSelf = {
    addEventListener: (type: string, fn: (event: unknown) => unknown) => {
      listeners[type] = fn;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue([]) },
    registration: { showNotification: vi.fn() },
  };
  const cacheStorage = fakeCacheStorage();
  const fetchMock = vi.fn();
  vi.stubGlobal('self', fakeSelf);
  vi.stubGlobal('caches', cacheStorage);
  vi.stubGlobal('fetch', fetchMock);
  // sw.js — классический скрипт без import/export (SW-рантайм это требует), поэтому для TS не модуль.
  // @ts-expect-error TS2306: File is not a module
  await import('../../public/sw.js');
  return { self: fakeSelf, test: fakeSelf.__test as SwTestExports, caches: cacheStorage, fetch: fetchMock, listeners };
}

function request(url: string, init: { method?: string; mode?: string; destination?: string } = {}): SwRequest {
  return {
    url,
    method: init.method ?? 'GET',
    mode: init.mode,
    destination: init.destination,
  };
}

describe('sw.js strategyFor', () => {
  let sw: Awaited<ReturnType<typeof loadSw>>;

  beforeEach(async () => {
    sw = await loadSw();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('навигация → navigate', () => {
    const req = request('https://vire.example/artists/foo', { mode: 'navigate' });
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('navigate');
  });

  it('/_next/static/** → static', () => {
    const req = request('https://vire.example/_next/static/chunks/main.js');
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('static');
  });

  it('/icons/** → static', () => {
    const req = request('https://vire.example/icons/system-sprite.svg');
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('static');
  });

  it('шрифт по destination → static', () => {
    const req = request('https://vire.example/some-font.woff2', { destination: 'font' });
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('static');
  });

  it('картинка по destination → image', () => {
    const req = request('https://s3.example/covers/1.jpg', { destination: 'image' });
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('image');
  });

  it('/_next/image → image', () => {
    const req = request('https://vire.example/_next/image?url=%2Fcover.jpg&w=256&q=75');
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('image');
  });

  it('манифест трека → manifest', () => {
    const req = request('https://vire.example/api/v1/tracks/abc-123/manifest');
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('manifest');
  });

  it('.m3u8 → hls', () => {
    const req = request('https://s3.example/vault/tracks/1/hls/index.m3u8');
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('hls');
  });

  it('.ts сегмент → hls', () => {
    const req = request('https://s3.example/vault/tracks/1/hls/chunk_003.ts');
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('hls');
  });

  it('прочий /api/** → bypass (network-only)', () => {
    const req = request('https://vire.example/api/v1/feed');
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('bypass');
  });

  it('не-GET запрос → bypass, даже если путь похож на manifest', () => {
    const req = request('https://vire.example/api/v1/tracks/abc/manifest', { method: 'POST' });
    const url = new URL(req.url);
    expect(sw.test.strategyFor(url, req)).toBe('bypass');
  });
});

describe('sw.js trimCache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('не трогает кэш в пределах лимита', async () => {
    const sw = await loadSw();
    const cache = fakeCache();
    for (let i = 0; i < 5; i++) await cache.put(`https://s3.example/${i}.jpg`, { i });
    await sw.test.trimCache(cache, 10);
    expect((await cache.keys()).length).toBe(5);
  });

  it('удаляет самые старые записи сверх лимита', async () => {
    const sw = await loadSw();
    const cache = fakeCache();
    for (let i = 0; i < 5; i++) await cache.put(`https://s3.example/${i}.jpg`, { i });
    await sw.test.trimCache(cache, 3);
    const keys = (await cache.keys()).map((k) => k.url);
    expect(keys).toEqual([
      'https://s3.example/2.jpg',
      'https://s3.example/3.jpg',
      'https://s3.example/4.jpg',
    ]);
  });
});

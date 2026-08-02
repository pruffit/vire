import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

const redisInstance = {
  on: vi.fn(),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
};

vi.mock('ioredis', () => ({
  default: vi.fn(function MockRedis() {
    return redisInstance;
  }),
}));

const { createLastfmTaste } = await import('./lastfm');

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  redisInstance.get.mockReset().mockResolvedValue(null);
  redisInstance.set.mockReset().mockResolvedValue('OK');
});

const topTracksResponse = () =>
  new Response(
    JSON.stringify({
      toptracks: {
        track: [
          { name: 'Песня', artist: { name: 'Артист' }, image: [{ '#text': '' }, { '#text': 'https://lastfm.freetls.fastly.net/i/u/174s/x.png' }] },
        ],
      },
    }),
    { status: 200 },
  );

describe('createLastfmTaste — без ключа или невалидного ника', () => {
  it('без ключа отдаёт [] и не ходит в сеть', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await createLastfmTaste(undefined).topTracks('user', 10)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('невалидный ник отдаёт [] и не ходит в сеть', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await createLastfmTaste('KEY').topTracks('../etc passwd!', 10)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('createLastfmTaste — с ключом', () => {
  it('маппит успешный ответ в MetadataHint (обложка с чужого хоста отпадает в null)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(topTracksResponse()));

    const hints = await createLastfmTaste('KEY').topTracks('user', 10);

    expect(hints).toEqual([{ title: 'Песня', artistName: 'Артист', coverUrl: null, durationSec: null }]);
  });

  it('сеть упала → []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    expect(await createLastfmTaste('KEY').topTracks('user', 10)).toEqual([]);
  });

  it('повторный вызов бьёт кэш, а не API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(topTracksResponse());
    vi.stubGlobal('fetch', fetchMock);

    const taste = createLastfmTaste('KEY');
    const first = await taste.topTracks('user', 10);
    redisInstance.get.mockResolvedValueOnce(JSON.stringify(first));
    const second = await taste.topTracks('user', 10);

    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createYoutubeResolver } from './youtube';

afterEach(() => vi.unstubAllGlobals());

interface VideoOverrides {
  embeddable: boolean;
  privacyStatus: string;
  ytRating: string;
  regionRestriction: { blocked?: string[]; allowed?: string[] };
  id: string;
  title: string;
  channelTitle: string;
}

const videosResponse = (overrides?: Partial<VideoOverrides>) =>
  new Response(
    JSON.stringify({
      items: [
        {
          id: overrides?.id ?? 'dQw4w9WgXcQ',
          snippet: {
            title: overrides?.title ?? 'Some Song',
            channelTitle: overrides?.channelTitle ?? 'Some Channel',
            thumbnails: { high: { url: 'https://img/high.jpg' } },
          },
          status: { embeddable: overrides?.embeddable ?? true, privacyStatus: overrides?.privacyStatus ?? 'public' },
          contentDetails: {
            duration: 'PT3M25S',
            ...(overrides?.ytRating ? { contentRating: { ytRating: overrides.ytRating } } : {}),
            ...(overrides?.regionRestriction ? { regionRestriction: overrides.regionRestriction } : {}),
          },
        },
      ],
    }),
    { status: 200 },
  );

const searchResponse = (...ids: string[]) =>
  new Response(JSON.stringify({ items: ids.map((id) => ({ id: { videoId: id } })) }), { status: 200 });

describe('createYoutubeResolver — without an API key', () => {
  it('resolveUrl returns null without ever calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const resolver = createYoutubeResolver(undefined);

    expect(await resolver.resolveUrl('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searchOne returns null without ever calling fetch (no quota spent)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const resolver = createYoutubeResolver(undefined);

    expect(await resolver.searchOne('some song')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('createYoutubeResolver — with an API key', () => {
  it('resolveUrl fetches videos.list for a known video id and maps the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(videosResponse());
    vi.stubGlobal('fetch', fetchMock);
    const resolver = createYoutubeResolver('KEY');

    const result = await resolver.resolveUrl('https://youtu.be/dQw4w9WgXcQ');

    expect(result).toEqual({
      source: 'YOUTUBE', externalId: 'dQw4w9WgXcQ', externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Some Song', artistName: 'Some Channel', coverUrl: 'https://img/high.jpg', durationSec: 205,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/videos?');
  });

  it('a non-embeddable video is not a candidate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(videosResponse({ embeddable: false })));
    const resolver = createYoutubeResolver('KEY');

    expect(await resolver.resolveUrl('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  it('a private video is not a candidate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(videosResponse({ privacyStatus: 'private' })));
    const resolver = createYoutubeResolver('KEY');

    expect(await resolver.resolveUrl('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  it('searchOne does search.list then videos.list and returns the mapped ref', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(searchResponse('dQw4w9WgXcQ'))
      .mockResolvedValueOnce(videosResponse());
    vi.stubGlobal('fetch', fetchMock);
    const resolver = createYoutubeResolver('KEY');

    const result = await resolver.searchOne('some song');

    expect(result?.externalId).toBe('dQw4w9WgXcQ');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/search?');
    expect(fetchMock.mock.calls[1][0]).toContain('/videos?');
  });

  it('ролик с возрастным цензом кандидатом не считается — во встроенном плеере он молчит', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(videosResponse({ ytRating: 'ytAgeRestricted' })));
    const resolver = createYoutubeResolver('KEY');

    expect(await resolver.resolveUrl('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  it('ролик, закрытый для региона сервера, кандидатом не считается', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(videosResponse({ regionRestriction: { blocked: ['RU'] } })));
    const resolver = createYoutubeResolver('KEY');

    expect(await resolver.resolveUrl('https://youtu.be/dQw4w9WgXcQ')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(videosResponse({ regionRestriction: { allowed: ['US'] } })));
    expect(await createYoutubeResolver('KEY').resolveUrl('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  it('searchOne перебирает выдачу дальше, если первый ролик неиграбелен', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(searchResponse('blocked-1', 'good-2'))
      .mockResolvedValueOnce(videosResponse({ id: 'blocked-1', ytRating: 'ytAgeRestricted' }))
      .mockResolvedValueOnce(videosResponse({ id: 'good-2' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createYoutubeResolver('KEY').searchOne('some song');

    expect(result?.externalId).toBe('good-2');
  });

  it('searchOne с ожиданием отбрасывает похожий, но другой трек', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(searchResponse('numb-1'))
      .mockResolvedValueOnce(videosResponse({ id: 'numb-1', title: 'Numb (Official Video)', channelTitle: 'PortisheadVEVO' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createYoutubeResolver('KEY').searchOne('Portishead Numbed In Moscow', {
      title: 'Numbed In Moscow',
      artistName: 'Portishead',
    });

    expect(result).toBeNull();
  });

  it('searchOne с ожиданием принимает тот же трек в шумном заголовке', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(searchResponse('bad-guy'))
      .mockResolvedValueOnce(videosResponse({ id: 'bad-guy', title: 'Billie Eilish - bad guy (Official Music Video)', channelTitle: 'BillieEilishVEVO' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createYoutubeResolver('KEY').searchOne('Billie Eilish bad guy', {
      title: 'bad guy',
      artistName: 'Billie Eilish',
    });

    expect(result?.externalId).toBe('bad-guy');
  });

  it('searchOne returns null when search.list has no results (no wasted videos.list call)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const resolver = createYoutubeResolver('KEY');

    expect(await resolver.searchOne('nothing')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('an unknown/non-YouTube URL cannot be resolved by id', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const resolver = createYoutubeResolver('KEY');

    expect(await resolver.resolveUrl('https://example.com/x')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a network failure degrades to null, not a throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const resolver = createYoutubeResolver('KEY');

    await expect(resolver.resolveUrl('https://youtu.be/dQw4w9WgXcQ')).resolves.toBeNull();
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchProviderMeta } from './providers';

afterEach(() => vi.unstubAllGlobals());

describe('fetchProviderMeta', () => {
  it('spotify: calls the oEmbed endpoint and maps title/thumbnail, no artist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ title: 'bad guy', thumbnail_url: 'https://image-cdn-ak.spotifycdn.com/x.jpg' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProviderMeta('https://open.spotify.com/track/abc123XYZ');

    expect(result).toEqual({ title: 'bad guy', artistName: null, coverUrl: 'https://image-cdn-ak.spotifycdn.com/x.jpg', durationSec: null });
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2Fabc123XYZ');
  });

  it('spotify: a non-200 response degrades to null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 302 })));
    expect(await fetchProviderMeta('https://open.spotify.com/track/abc123')).toBeNull();
  });

  it('apple-music: calls iTunes lookup by id and maps track fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ results: [{ trackName: 'bad guy', artistName: 'Billie Eilish', artworkUrl100: 'https://a/100x100bb.jpg', trackTimeMillis: 194088 }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProviderMeta('https://music.apple.com/us/song/bad-guy/1450695306');

    expect(result).toEqual({ title: 'bad guy', artistName: 'Billie Eilish', coverUrl: 'https://a/600x600bb.jpg', durationSec: 194 });
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://itunes.apple.com/lookup?id=1450695306');
  });

  it('apple-music: an id from the ?i= query param on an album URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [{ trackName: 'bad guy', artistName: 'Billie Eilish' }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchProviderMeta('https://music.apple.com/us/album/when-we-all-fall-asleep/1450695305?i=1450695306');

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://itunes.apple.com/lookup?id=1450695306');
  });

  it('apple-music: an empty lookup (no results) degrades to null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ resultCount: 0, results: [] }), { status: 200 })));
    expect(await fetchProviderMeta('https://music.apple.com/us/song/x/1')).toBeNull();
  });

  it('deezer: calls the track API by id and maps fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ title: 'bad guy', artist: { name: 'Billie Eilish' }, album: { cover_medium: 'https://e-cdns-images.dzcdn.net/x.jpg' }, duration: 194 }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProviderMeta('https://www.deezer.com/ru/track/123456789');

    expect(result).toEqual({ title: 'bad guy', artistName: 'Billie Eilish', coverUrl: 'https://e-cdns-images.dzcdn.net/x.jpg', durationSec: 194 });
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://api.deezer.com/track/123456789');
  });

  it('deezer: an {error} body (unknown id) degrades to null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { type: 'DataException', message: 'no data' } }), { status: 200 })));
    expect(await fetchProviderMeta('https://www.deezer.com/track/0')).toBeNull();
  });

  it('a network failure degrades to null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await fetchProviderMeta('https://open.spotify.com/track/abc123')).toBeNull();
  });

  it('a non-provider URL returns null without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchProviderMeta('https://example.com/track/1')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

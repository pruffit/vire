import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchOembed } from './oembed';

afterEach(() => vi.unstubAllGlobals());

describe('fetchOembed', () => {
  it('calls the YouTube oEmbed endpoint for a youtube.com URL and maps the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'Some Song', author_name: 'Some Artist', thumbnail_url: 'https://img' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchOembed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    expect(result).toEqual({ title: 'Some Song', artistName: 'Some Artist', coverUrl: 'https://img', durationSec: null });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&format=json');
  });

  it('calls the SoundCloud oEmbed endpoint for a soundcloud.com URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'A Track', author_name: 'An Artist' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchOembed('https://soundcloud.com/an-artist/a-track');

    expect(result).toEqual({ title: 'A Track', artistName: 'An Artist', coverUrl: null, durationSec: null });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('https://soundcloud.com/oembed?url=');
  });

  it('returns null for a host with no known oEmbed endpoint', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchOembed('https://open.spotify.com/track/abc')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a 401 (e.g. embedding disabled/private video) degrades to null, not a throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })));
    expect(await fetchOembed('https://youtu.be/private123')).toBeNull();
  });

  it('a network failure degrades to null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await fetchOembed('https://youtu.be/x')).toBeNull();
  });

  it('a response with no title is treated as unresolved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ author_name: 'X' }), { status: 200 })));
    expect(await fetchOembed('https://youtu.be/x')).toBeNull();
  });
});

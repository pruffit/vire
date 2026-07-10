import { describe, expect, it, vi, afterEach } from 'vitest';
import { followArtist, likeTrack, likePlaylist, presaveRelease, presaveReleaseAsGuest } from '../toggles';

function mockOkFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

describe('toggles', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('followArtist: POST при next=true, DELETE при next=false, верный URL', async () => {
    const fetchMock = mockOkFetch({ following: true });
    vi.stubGlobal('fetch', fetchMock);

    await followArtist('some-slug', true);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/artists/some-slug/follow', expect.objectContaining({ method: 'POST' }));

    await followArtist('some-slug', false);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/artists/some-slug/follow', expect.objectContaining({ method: 'DELETE' }));
  });

  it('likeTrack: верный URL и метод', async () => {
    const fetchMock = mockOkFetch({ liked: true });
    vi.stubGlobal('fetch', fetchMock);

    await likeTrack('track-1', true);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tracks/track-1/like', expect.objectContaining({ method: 'POST' }));
  });

  it('likePlaylist: верный URL и метод', async () => {
    const fetchMock = mockOkFetch({ liked: false });
    vi.stubGlobal('fetch', fetchMock);

    await likePlaylist('playlist-1', false);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/playlists/playlist-1/like', expect.objectContaining({ method: 'DELETE' }));
  });

  it('presaveRelease: верный URL и метод', async () => {
    const fetchMock = mockOkFetch({ presaved: true });
    vi.stubGlobal('fetch', fetchMock);

    await presaveRelease('release-1', true);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/releases/release-1/presave', expect.objectContaining({ method: 'POST' }));
  });

  it('presaveReleaseAsGuest: POST с email в теле', async () => {
    const fetchMock = mockOkFetch({ presaved: true, guest: true });
    vi.stubGlobal('fetch', fetchMock);

    await presaveReleaseAsGuest('release-1', 'a@b.com');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/releases/release-1/presave',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b.com' }) }),
    );
  });
});

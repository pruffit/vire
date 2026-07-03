import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchReleaseTracks, fetchPlaylistTracks } from './lazy-queue-fetchers';

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchReleaseTracks', () => {
  it('null при сетевой ошибке — сбой не должен кэшироваться как пустой релиз', async () => {
    mockFetch(() => Promise.reject(new Error('network down')));
    expect(await fetchReleaseTracks('r1')).toBeNull();
  });

  it('null при не-2xx ответе', async () => {
    mockFetch(async () => jsonResponse({ error: 'Release not found' }, 404));
    expect(await fetchReleaseTracks('r1')).toBeNull();
  });

  it('null при битом JSON', async () => {
    mockFetch(async () => new Response('not-json', { status: 200 }));
    expect(await fetchReleaseTracks('r1')).toBeNull();
  });

  it('[] при 200 без треков — честная пустота, кэшируемая', async () => {
    mockFetch(async () => jsonResponse({ release: { id: 'r1' }, tracks: [] }));
    expect(await fetchReleaseTracks('r1')).toEqual([]);
  });

  it('треки при успешном ответе', async () => {
    const tracks = [{ id: 't1', title: 'T', trackNumber: 1, durationSec: 60, status: 'READY' }];
    mockFetch(async () => jsonResponse({ tracks }));
    expect(await fetchReleaseTracks('r1')).toEqual(tracks);
  });
});

describe('fetchPlaylistTracks', () => {
  it('null при сетевой ошибке', async () => {
    mockFetch(() => Promise.reject(new Error('network down')));
    expect(await fetchPlaylistTracks('p1')).toBeNull();
  });

  it('null при не-2xx ответе', async () => {
    mockFetch(async () => jsonResponse({ error: 'Forbidden' }, 403));
    expect(await fetchPlaylistTracks('p1')).toBeNull();
  });

  it('[] при 200 с пустым плейлистом', async () => {
    mockFetch(async () => jsonResponse({ playlist: { tracks: [] } }));
    expect(await fetchPlaylistTracks('p1')).toEqual([]);
  });

  it('треки при успешном ответе', async () => {
    const tracks = [{
      id: 't1', title: 'T', durationSec: 60, position: 0, artistName: 'A',
      artistSlug: 'a', releaseId: 'r1', coverUrl: null, accentColor: null, isExplicit: false,
    }];
    mockFetch(async () => jsonResponse({ playlist: { tracks } }));
    expect(await fetchPlaylistTracks('p1')).toEqual(tracks);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../api-client', () => ({ apiRequest: request }));

import {
  fetchPlaylistsForTrack,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  createPlaylist,
} from '../playlists';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchPlaylistsForTrack', () => {
  it('GET /api/v1/playlists?trackId=... с нужной схемой', async () => {
    request.mockResolvedValue({ ok: true, data: { playlists: [], inPlaylists: [] } });

    await fetchPlaylistsForTrack('t1');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/playlists?trackId=t1',
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('экранирует trackId в query', async () => {
    request.mockResolvedValue({ ok: true, data: { playlists: [] } });

    await fetchPlaylistsForTrack('t 1/2');

    expect(request).toHaveBeenCalledWith(
      `/api/v1/playlists?trackId=${encodeURIComponent('t 1/2')}`,
      expect.anything(),
    );
  });
});

describe('addTrackToPlaylist', () => {
  it('POST /api/v1/playlists/{id}/tracks с телом {trackId}', async () => {
    request.mockResolvedValue({ ok: true, data: { ok: true } });

    await addTrackToPlaylist('p1', 't1');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/playlists/p1/tracks',
      expect.objectContaining({ method: 'POST', body: { trackId: 't1' } }),
    );
  });
});

describe('removeTrackFromPlaylist', () => {
  it('DELETE /api/v1/playlists/{id}/tracks/{trackId}', async () => {
    request.mockResolvedValue({ ok: true, data: { ok: true } });

    await removeTrackFromPlaylist('p1', 't1');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/playlists/p1/tracks/t1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('createPlaylist', () => {
  it('POST /api/v1/playlists с телом {title}', async () => {
    request.mockResolvedValue({ ok: true, data: { id: 'p2' } });

    const result = await createPlaylist('Новый плейлист');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/playlists',
      expect.objectContaining({ method: 'POST', body: { title: 'Новый плейлист' } }),
    );
    expect(result).toEqual({ ok: true, data: { id: 'p2' } });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { likePlaylist, unlikePlaylist, getPlaylistLikeState } = vi.hoisted(() => ({
  likePlaylist: vi.fn(),
  unlikePlaylist: vi.fn(),
  getPlaylistLikeState: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(),
}));
vi.mock('@vire/db', () => ({ likePlaylist, unlikePlaylist, getPlaylistLikeState }));

import { auth } from '@/auth';
import { GET, POST, DELETE } from './route';

const mockedAuth = vi.mocked(auth);
const PLAYLIST_ID = 'playlist-1';
const ctx = { params: Promise.resolve({ id: PLAYLIST_ID }) };
const req = (method: string) => new Request(`http://localhost/api/v1/playlists/${PLAYLIST_ID}/like`, { method });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/playlists/[id]/like', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req('GET'), ctx);
    expect(res.status).toBe(401);
    expect(getPlaylistLikeState).not.toHaveBeenCalled();
  });

  it('returns liked state', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getPlaylistLikeState.mockResolvedValue(true);
    const res = await GET(req('GET'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ liked: true });
    expect(getPlaylistLikeState).toHaveBeenCalledWith('u1', PLAYLIST_ID);
  });
});

describe('POST /api/v1/playlists/[id]/like', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req('POST'), ctx);
    expect(res.status).toBe(401);
    expect(likePlaylist).not.toHaveBeenCalled();
  });

  it('likes the playlist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(req('POST'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ liked: true });
    expect(likePlaylist).toHaveBeenCalledWith('u1', PLAYLIST_ID);
  });
});

describe('DELETE /api/v1/playlists/[id]/like', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await DELETE(req('DELETE'), ctx);
    expect(res.status).toBe(401);
    expect(unlikePlaylist).not.toHaveBeenCalled();
  });

  it('unlikes the playlist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await DELETE(req('DELETE'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ liked: false });
    expect(unlikePlaylist).toHaveBeenCalledWith('u1', PLAYLIST_ID);
  });
});

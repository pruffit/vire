import { describe, it, expect, vi, beforeEach } from 'vitest';

const { like, unlike, getLikeState } = vi.hoisted(() => ({
  like: vi.fn(),
  unlike: vi.fn(),
  getLikeState: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    like = like;
    unlike = unlike;
    getLikeState = getLikeState;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

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
    expect(getLikeState).not.toHaveBeenCalled();
  });

  it('returns liked state', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getLikeState.mockResolvedValue(true);
    const res = await GET(req('GET'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ liked: true });
    expect(getLikeState).toHaveBeenCalledWith('u1', PLAYLIST_ID);
  });
});

describe('POST /api/v1/playlists/[id]/like', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req('POST'), ctx);
    expect(res.status).toBe(401);
    expect(like).not.toHaveBeenCalled();
  });

  it('likes the playlist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(req('POST'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ liked: true });
    expect(like).toHaveBeenCalledWith('u1', PLAYLIST_ID);
  });
});

describe('DELETE /api/v1/playlists/[id]/like', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await DELETE(req('DELETE'), ctx);
    expect(res.status).toBe(401);
    expect(unlike).not.toHaveBeenCalled();
  });

  it('unlikes the playlist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await DELETE(req('DELETE'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ liked: false });
    expect(unlike).toHaveBeenCalledWith('u1', PLAYLIST_ID);
  });
});

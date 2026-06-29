import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getUserPlaylists, getTrackPlaylistIds, createPlaylist } = vi.hoisted(() => ({
  getUserPlaylists: vi.fn(),
  getTrackPlaylistIds: vi.fn(),
  createPlaylist: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ getUserPlaylists, getTrackPlaylistIds, createPlaylist }));

import { auth } from '@/auth';
import { GET } from './route';
const mockedAuth = vi.mocked(auth);

const TRACK = '11111111-1111-4111-8111-111111111111';

function makeReq(url = 'http://localhost/api/v1/playlists'): Request {
  return new Request(url, { method: 'GET' });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/playlists', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await GET(makeReq())).status).toBe(401);
  });

  it('200 returns playlists without trackId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getUserPlaylists.mockResolvedValue([{ id: 'p1', title: 'A', trackCount: 0 }]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.playlists).toHaveLength(1);
    expect(body.inPlaylists).toBeUndefined();
    expect(getTrackPlaylistIds).not.toHaveBeenCalled();
  });

  it('200 includes inPlaylists when trackId is a valid uuid', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getUserPlaylists.mockResolvedValue([{ id: 'p1', title: 'A', trackCount: 1 }]);
    getTrackPlaylistIds.mockResolvedValue(['p1']);
    const res = await GET(makeReq(`http://localhost/api/v1/playlists?trackId=${TRACK}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inPlaylists).toEqual(['p1']);
    expect(getTrackPlaylistIds).toHaveBeenCalledWith('u1', TRACK);
  });

  it('400 when trackId is not a uuid', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getUserPlaylists.mockResolvedValue([]);
    const res = await GET(makeReq('http://localhost/api/v1/playlists?trackId=nope'));
    expect(res.status).toBe(400);
    expect(getTrackPlaylistIds).not.toHaveBeenCalled();
  });
});

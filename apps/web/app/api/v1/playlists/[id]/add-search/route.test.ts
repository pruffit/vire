import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getWithTracks, searchTracks } = vi.hoisted(() => ({
  getWithTracks: vi.fn(),
  searchTracks: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    getWithTracks = getWithTracks;
    searchTracks = searchTracks;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

import { auth } from '@/auth';
import { GET } from './route';
const mockedAuth = vi.mocked(auth);

function makeReq(q?: string): Request {
  const url = q !== undefined
    ? `http://localhost/api/v1/playlists/p1/add-search?q=${encodeURIComponent(q)}`
    : 'http://localhost/api/v1/playlists/p1/add-search';
  return new Request(url);
}
const ctx = { params: Promise.resolve({ id: 'p1' }) };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/playlists/[id]/add-search', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await GET(makeReq('rock'), ctx)).status).toBe(401);
  });
  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue(null);
    expect((await GET(makeReq('rock'), ctx)).status).toBe(404);
  });
  it('403 when not owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'other', tracks: [] });
    expect((await GET(makeReq('rock'), ctx)).status).toBe(403);
  });
  it('200 returns empty when q < 2 chars', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1', tracks: [] });
    const res = await GET(makeReq('r'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ tracks: [] });
    expect(searchTracks).not.toHaveBeenCalled();
  });
  it('200 returns empty when no q', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1', tracks: [] });
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ tracks: [] });
    expect(searchTracks).not.toHaveBeenCalled();
  });
  it('200 searches and returns tracks', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1', tracks: [{ id: 'track1' }] });
    const mockTracks = [{ id: 'track2', title: 'Rock Song' }];
    searchTracks.mockResolvedValue(mockTracks);
    const res = await GET(makeReq('rock'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ tracks: mockTracks });
    expect(searchTracks).toHaveBeenCalledWith('rock', ['track1'], 20);
  });
});

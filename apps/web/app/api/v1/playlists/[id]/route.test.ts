import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getWithTracks, deletePlaylist, update } = vi.hoisted(() => ({
  getWithTracks: vi.fn(),
  deletePlaylist: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    getWithTracks = getWithTracks;
    delete = deletePlaylist;
    update = update;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

import { auth } from '@/auth';
import { GET, PATCH, DELETE } from './route';
const mockedAuth = vi.mocked(auth);

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/v1/playlists/p1', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: 'p1' }) };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/playlists/[id]', () => {
  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getWithTracks.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/v1/playlists/p1'), ctx);
    expect(res.status).toBe(404);
  });

  it('403 for an anonymous viewer on a PRIVATE playlist', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getWithTracks.mockResolvedValue({ id: 'p1', visibility: 'PRIVATE', ownerUserId: 'owner-1', tracks: [] });
    const res = await GET(new Request('http://localhost/api/v1/playlists/p1'), ctx);
    expect(res.status).toBe(403);
  });

  it('403 for a non-owner viewer on a PRIVATE playlist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'other' } } as never);
    getWithTracks.mockResolvedValue({ id: 'p1', visibility: 'PRIVATE', ownerUserId: 'owner-1', tracks: [] });
    const res = await GET(new Request('http://localhost/api/v1/playlists/p1'), ctx);
    expect(res.status).toBe(403);
  });

  it('200 for the owner on a PRIVATE playlist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getWithTracks.mockResolvedValue({ id: 'p1', visibility: 'PRIVATE', ownerUserId: 'owner-1', tracks: [] });
    const res = await GET(new Request('http://localhost/api/v1/playlists/p1'), ctx);
    expect(res.status).toBe(200);
  });

  it('200 for an anonymous viewer on a PUBLIC playlist', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getWithTracks.mockResolvedValue({ id: 'p1', visibility: 'PUBLIC', ownerUserId: 'owner-1', tracks: [] });
    const res = await GET(new Request('http://localhost/api/v1/playlists/p1'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ playlist: { id: 'p1', visibility: 'PUBLIC', ownerUserId: 'owner-1', tracks: [] } });
  });
});

describe('PATCH /api/v1/playlists/[id]', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await PATCH(makeReq({ title: 'X' }), ctx)).status).toBe(401);
  });
  it('400 on invalid visibility', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(makeReq({ visibility: 'SECRET' }), ctx);
    expect(res.status).toBe(400);
  });
  it('updates description + visibility', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1', tracks: [] });
    const res = await PATCH(makeReq({ description: '  hi  ', visibility: 'PUBLIC' }), ctx);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith('p1', 'u1', { description: 'hi', visibility: 'PUBLIC' });
  });
  it('updates title only', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1', tracks: [] });
    const res = await PATCH(makeReq({ title: '  New name  ' }), ctx);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith('p1', 'u1', { title: 'New name' });
  });
  it('403 when non-owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'other-user', tracks: [] });
    const res = await PATCH(makeReq({ title: 'X' }), ctx);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/playlists/[id]', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const req = new Request('http://localhost/api/v1/playlists/p1', { method: 'DELETE' });
    expect((await DELETE(req, ctx)).status).toBe(401);
  });
  it('404 when not found or forbidden', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    deletePlaylist.mockResolvedValue(false);
    const req = new Request('http://localhost/api/v1/playlists/p1', { method: 'DELETE' });
    expect((await DELETE(req, ctx)).status).toBe(404);
  });
  it('200 on success', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    deletePlaylist.mockResolvedValue(true);
    const req = new Request('http://localhost/api/v1/playlists/p1', { method: 'DELETE' });
    expect((await DELETE(req, ctx)).status).toBe(200);
  });
});

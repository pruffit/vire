import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPlaylistWithTracks, deletePlaylist, updatePlaylist } = vi.hoisted(() => ({
  getPlaylistWithTracks: vi.fn(),
  deletePlaylist: vi.fn(),
  updatePlaylist: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ getPlaylistWithTracks, deletePlaylist, updatePlaylist }));

import { auth } from '@/auth';
import { PATCH, DELETE } from './route';
const mockedAuth = vi.mocked(auth);

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/v1/playlists/p1', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: 'p1' }) };

beforeEach(() => vi.clearAllMocks());

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
    const res = await PATCH(makeReq({ description: '  hi  ', visibility: 'PUBLIC' }), ctx);
    expect(res.status).toBe(200);
    expect(updatePlaylist).toHaveBeenCalledWith('p1', 'u1', { description: 'hi', visibility: 'PUBLIC' });
  });
  it('updates title only', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(makeReq({ title: '  New name  ' }), ctx);
    expect(res.status).toBe(200);
    expect(updatePlaylist).toHaveBeenCalledWith('p1', 'u1', { title: 'New name' });
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

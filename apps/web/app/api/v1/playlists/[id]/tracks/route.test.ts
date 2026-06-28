import { describe, it, expect, vi, beforeEach } from 'vitest';

const { reorderPlaylistTracks, getPlaylistWithTracks, addTrackToPlaylist, trackExists } =
  vi.hoisted(() => ({
    reorderPlaylistTracks: vi.fn(),
    getPlaylistWithTracks: vi.fn(),
    addTrackToPlaylist: vi.fn(),
    trackExists: vi.fn(),
  }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ reorderPlaylistTracks, getPlaylistWithTracks, addTrackToPlaylist, trackExists }));

import { auth } from '@/auth';
import { PUT } from './route';
const mockedAuth = vi.mocked(auth);

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/v1/playlists/p1/tracks', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: 'p1' }) };

beforeEach(() => vi.clearAllMocks());

describe('PUT /api/v1/playlists/[id]/tracks (reorder)', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await PUT(makeReq({ trackIds: ['a'] }), ctx)).status).toBe(401);
  });
  it('400 on invalid body', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    expect((await PUT(makeReq({ trackIds: 'nope' }), ctx)).status).toBe(400);
  });
  it('403 when not owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getPlaylistWithTracks.mockResolvedValue({ ownerUserId: 'other' });
    expect((await PUT(makeReq({ trackIds: ['a', 'b'] }), ctx)).status).toBe(403);
  });
  it('409 when reorder rejected (set mismatch)', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getPlaylistWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    reorderPlaylistTracks.mockResolvedValue(false);
    expect((await PUT(makeReq({ trackIds: ['a', 'b'] }), ctx)).status).toBe(409);
  });
  it('200 on success', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getPlaylistWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    reorderPlaylistTracks.mockResolvedValue(true);
    const res = await PUT(makeReq({ trackIds: ['b', 'a'] }), ctx);
    expect(res.status).toBe(200);
    expect(reorderPlaylistTracks).toHaveBeenCalledWith('p1', 'u1', ['b', 'a']);
  });
});

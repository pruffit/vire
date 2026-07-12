import { describe, it, expect, vi, beforeEach } from 'vitest';

const { reorder, getWithTracks, addTrack, trackExists } =
  vi.hoisted(() => ({
    reorder: vi.fn(),
    getWithTracks: vi.fn(),
    addTrack: vi.fn(),
    trackExists: vi.fn(),
  }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    reorder = reorder;
    getWithTracks = getWithTracks;
    addTrack = addTrack;
    trackExists = trackExists;
  },
}));

import { auth } from '@/auth';
import { PUT, POST } from './route';
const mockedAuth = vi.mocked(auth);

function makeReq(method: string, body: unknown): Request {
  return new Request('http://localhost/api/v1/playlists/p1/tracks', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: 'p1' }) };

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

beforeEach(() => vi.clearAllMocks());

describe('PUT /api/v1/playlists/[id]/tracks (reorder)', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await PUT(makeReq('PUT', { trackIds: [A] }), ctx)).status).toBe(401);
  });
  it('400 on invalid body', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    expect((await PUT(makeReq('PUT', { trackIds: 'nope' }), ctx)).status).toBe(400);
  });
  it('400 on non-uuid track ids', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    expect((await PUT(makeReq('PUT', { trackIds: ['a', 'b'] }), ctx)).status).toBe(400);
  });
  it('403 when not owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'other' });
    expect((await PUT(makeReq('PUT', { trackIds: [A, B] }), ctx)).status).toBe(403);
  });
  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue(null);
    expect((await PUT(makeReq('PUT', { trackIds: [A, B] }), ctx)).status).toBe(404);
  });
  it('409 when reorder rejected (set mismatch)', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    reorder.mockResolvedValue(false);
    expect((await PUT(makeReq('PUT', { trackIds: [A, B] }), ctx)).status).toBe(409);
  });
  it('200 on success', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    reorder.mockResolvedValue(true);
    const res = await PUT(makeReq('PUT', { trackIds: [B, A] }), ctx);
    expect(res.status).toBe(200);
    expect(reorder).toHaveBeenCalledWith('p1', 'u1', [B, A]);
  });
});

describe('POST /api/v1/playlists/[id]/tracks (add)', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await POST(makeReq('POST', { trackId: A }), ctx)).status).toBe(401);
  });
  it('400 on invalid body', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    expect((await POST(makeReq('POST', { trackId: 'nope' }), ctx)).status).toBe(400);
    expect(addTrack).not.toHaveBeenCalled();
  });
  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue(null);
    const res = await POST(makeReq('POST', { trackId: A }), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
  });
  it('403 when not owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'other' });
    const res = await POST(makeReq('POST', { trackId: A }), ctx);
    expect(res.status).toBe(403);
    expect(trackExists).not.toHaveBeenCalled();
  });
  it('404 with a distinct message when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    trackExists.mockResolvedValue(false);
    const res = await POST(makeReq('POST', { trackId: A }), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Track not found' });
    expect(addTrack).not.toHaveBeenCalled();
  });
  it('200 adds the track', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    trackExists.mockResolvedValue(true);
    const res = await POST(makeReq('POST', { trackId: A }), ctx);
    expect(res.status).toBe(200);
    expect(addTrack).toHaveBeenCalledWith('p1', A, 'u1');
  });
});

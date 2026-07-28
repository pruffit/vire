import { describe, it, expect, vi, beforeEach } from 'vitest';

const { reorder, getWithTracks, addTrack, trackExists, isCollaborator, getCollabState } =
  vi.hoisted(() => ({
    reorder: vi.fn(),
    getWithTracks: vi.fn(),
    addTrack: vi.fn(),
    trackExists: vi.fn(),
    isCollaborator: vi.fn(),
    getCollabState: vi.fn(),
  }));
const { publishChannel } = vi.hoisted(() => ({ publishChannel: vi.fn() }));
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }) }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@/lib/realtime', () => ({ publishChannel, playlistChannel: (id: string) => `rt:playlist:${id}` }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit, tooManyRequests: vi.fn(() => new Response(null, { status: 429 })) }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    reorder = reorder;
    getWithTracks = getWithTracks;
    addTrack = addTrack;
    trackExists = trackExists;
    isCollaborator = isCollaborator;
    getCollabState = getCollabState;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

import { auth } from '@/auth';
import { GET, PUT, POST } from './route';
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

describe('GET /api/v1/playlists/[id]/tracks', () => {
  const req = (url = 'http://localhost/api/v1/playlists/p1/tracks') => new Request(url);

  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getWithTracks.mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(404);
  });

  it('403 for an anonymous viewer on a PRIVATE playlist without a token', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getWithTracks.mockResolvedValue({ id: 'p1', visibility: 'PRIVATE', ownerUserId: 'owner-1', isCollaborative: false, version: 2, tracks: [] });
    expect((await GET(req(), ctx)).status).toBe(403);
  });

  it('200 for the owner, returns tracks + version', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getWithTracks.mockResolvedValue({ id: 'p1', visibility: 'PRIVATE', ownerUserId: 'owner-1', isCollaborative: false, version: 2, tracks: [{ id: 't1' }] });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ tracks: [{ id: 't1' }], version: 2 });
  });

  it('403 анониму даже с валидным токеном — состав не отдаём без аккаунта', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getWithTracks.mockResolvedValue({ id: 'p1', visibility: 'PRIVATE', ownerUserId: 'owner-1', isCollaborative: true, version: 5, tracks: [] });
    getCollabState.mockResolvedValue({ isCollaborative: true, collabToken: 'good-token', version: 5, ownerUserId: 'owner-1' });
    const res = await GET(req('http://localhost/api/v1/playlists/p1/tracks?token=good-token'), ctx);
    expect(res.status).toBe(403);
  });

  it('200 залогиненному приглашённому с валидным токеном', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'invited-1' } } as never);
    getWithTracks.mockResolvedValue({ id: 'p1', visibility: 'PRIVATE', ownerUserId: 'owner-1', isCollaborative: true, version: 5, tracks: [] });
    getCollabState.mockResolvedValue({ isCollaborative: true, collabToken: 'good-token', version: 5, ownerUserId: 'owner-1' });
    const res = await GET(req('http://localhost/api/v1/playlists/p1/tracks?token=good-token'), ctx);
    expect(res.status).toBe(200);
  });
});

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
    getWithTracks.mockResolvedValue({ ownerUserId: 'other', isCollaborative: false });
    expect((await PUT(makeReq('PUT', { trackIds: [A, B] }), ctx)).status).toBe(403);
  });
  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue(null);
    expect((await PUT(makeReq('PUT', { trackIds: [A, B] }), ctx)).status).toBe(404);
  });
  it('409 when reorder rejected (set mismatch)', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1', isCollaborative: false });
    reorder.mockResolvedValue(null);
    expect((await PUT(makeReq('PUT', { trackIds: [A, B] }), ctx)).status).toBe(409);
  });
  it('200 on success', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1', isCollaborative: false });
    reorder.mockResolvedValue(4);
    const res = await PUT(makeReq('PUT', { trackIds: [B, A] }), ctx);
    expect(res.status).toBe(200);
    expect(reorder).toHaveBeenCalledWith('p1', 'u1', [B, A]);
  });
  it('a collaborator can reorder on a collaborative playlist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: true });
    isCollaborator.mockResolvedValue(true);
    reorder.mockResolvedValue(2);
    const res = await PUT(makeReq('PUT', { trackIds: [B, A] }), ctx);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/playlists/[id]/tracks (add)', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await POST(makeReq('POST', { trackId: A }), ctx)).status).toBe(401);
  });
  it('429 when rate limited', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    rateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 60 });
    expect((await POST(makeReq('POST', { trackId: A }), ctx)).status).toBe(429);
    expect(addTrack).not.toHaveBeenCalled();
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
    getWithTracks.mockResolvedValue({ ownerUserId: 'other', isCollaborative: false });
    const res = await POST(makeReq('POST', { trackId: A }), ctx);
    expect(res.status).toBe(403);
    expect(trackExists).not.toHaveBeenCalled();
  });
  it('404 with a distinct message when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1', isCollaborative: false });
    trackExists.mockResolvedValue(false);
    const res = await POST(makeReq('POST', { trackId: A }), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Track not found' });
    expect(addTrack).not.toHaveBeenCalled();
  });
  it('200 adds the track', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1', isCollaborative: false });
    trackExists.mockResolvedValue(true);
    addTrack.mockResolvedValue(3);
    const res = await POST(makeReq('POST', { trackId: A }), ctx);
    expect(res.status).toBe(200);
    expect(addTrack).toHaveBeenCalledWith('p1', A, 'u1');
    expect(publishChannel).toHaveBeenCalledWith('rt:playlist:p1', { type: 'playlist:changed', playlistId: 'p1', version: 3, actorId: 'u1' });
  });
  it('a collaborator can add a track on a collaborative playlist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: true });
    isCollaborator.mockResolvedValue(true);
    trackExists.mockResolvedValue(true);
    addTrack.mockResolvedValue(1);
    const res = await POST(makeReq('POST', { trackId: A }), ctx);
    expect(res.status).toBe(200);
  });
});

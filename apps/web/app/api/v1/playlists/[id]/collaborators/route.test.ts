import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playlistCollaboratorsResponseSchema, playlistJoinResponseSchema, okResponseSchema } from '@vire/api-contracts';

const { getCollabState, isCollaborator, listCollaborators, joinCollaborator, removeCollaborator, getWithTracks } = vi.hoisted(() => ({
  getCollabState: vi.fn(),
  isCollaborator: vi.fn(),
  listCollaborators: vi.fn(),
  joinCollaborator: vi.fn(),
  removeCollaborator: vi.fn(),
  getWithTracks: vi.fn(),
}));
const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));
const { publishChannel } = vi.hoisted(() => ({ publishChannel: vi.fn() }));
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }) }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@/lib/realtime', () => ({ publishChannel, playlistChannel: (id: string) => `rt:playlist:${id}` }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit, tooManyRequests: vi.fn(() => new Response(null, { status: 429 })) }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    getCollabState = getCollabState;
    isCollaborator = isCollaborator;
    listCollaborators = listCollaborators;
    joinCollaborator = joinCollaborator;
    removeCollaborator = removeCollaborator;
    getWithTracks = getWithTracks;
  },
  DrizzleBlockRepository: class {
    existsEitherWay = vi.fn().mockResolvedValue(false);
  },
  DrizzleNotificationRepository: class {
    insert = insert;
  },
}));

import { auth } from '@/auth';
import { GET, POST, DELETE } from './route';
const mockedAuth = vi.mocked(auth);

const ctx = { params: Promise.resolve({ id: 'p1' }) };
const collabState = {
  isCollaborative: true, collabToken: 'good-token', version: 0, ownerUserId: 'owner-1',
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/playlists/[id]/collaborators', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(new Request('http://localhost/api/v1/playlists/p1/collaborators'), ctx);
    expect(res.status).toBe(401);
  });

  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/v1/playlists/p1/collaborators'), ctx);
    expect(res.status).toBe(404);
  });

  it('403 for a stranger', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'random' } } as never);
    getCollabState.mockResolvedValue(collabState);
    isCollaborator.mockResolvedValue(false);
    const res = await GET(new Request('http://localhost/api/v1/playlists/p1/collaborators'), ctx);
    expect(res.status).toBe(403);
  });

  it('200 for the owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue(collabState);
    listCollaborators.mockResolvedValue([{ userId: 'collab-1', name: 'A', image: null, joinedAt: new Date('2026-01-01') }]);
    const res = await GET(new Request('http://localhost/api/v1/playlists/p1/collaborators'), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.collaborators).toHaveLength(1);
    expect(json.collaborators[0].joinedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(playlistCollaboratorsResponseSchema.safeParse(json).success).toBe(true);
  });
});

describe('POST /api/v1/playlists/[id]/collaborators (join)', () => {
  const req = (body: unknown) => new Request('http://localhost/api/v1/playlists/p1/collaborators', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await POST(req({ token: 'good-token' }), ctx)).status).toBe(401);
  });

  it('429 when rate limited', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    rateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 60 });
    expect((await POST(req({ token: 'good-token' }), ctx)).status).toBe(429);
    expect(joinCollaborator).not.toHaveBeenCalled();
  });

  it('400 on invalid body', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    expect((await POST(req({}), ctx)).status).toBe(400);
  });

  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getCollabState.mockResolvedValue(null);
    expect((await POST(req({ token: 'good-token' }), ctx)).status).toBe(404);
  });

  it('403 on an invalid token', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getCollabState.mockResolvedValue(collabState);
    const res = await POST(req({ token: 'wrong-token' }), ctx);
    expect(res.status).toBe(403);
    expect(joinCollaborator).not.toHaveBeenCalled();
  });

  it('403 when caller is the owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue(collabState);
    expect((await POST(req({ token: 'good-token' }), ctx)).status).toBe(403);
  });

  it('409 when the playlist is at the collaborator cap', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getCollabState.mockResolvedValue(collabState);
    joinCollaborator.mockResolvedValue('full');
    expect((await POST(req({ token: 'good-token' }), ctx)).status).toBe(409);
  });

  it('200 joins, notifies the owner and broadcasts', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getCollabState.mockResolvedValue(collabState);
    joinCollaborator.mockResolvedValue('joined');
    getWithTracks.mockResolvedValue({ id: 'p1' });
    const res = await POST(req({ token: 'good-token' }), ctx);
    expect(res.status).toBe(200);
    expect(joinCollaborator).toHaveBeenCalledWith('p1', 'collab-1', 'owner-1', 50);
    expect(insert).toHaveBeenCalledWith('owner-1', 'PLAYLIST_COLLAB_JOIN', 'collab-1', 'p1');
    expect(publishChannel).toHaveBeenCalledWith('rt:playlist:p1', { type: 'playlist:collaborators', playlistId: 'p1', actorId: 'collab-1' });
  });

  it('response matches the contract schema', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getCollabState.mockResolvedValue(collabState);
    joinCollaborator.mockResolvedValue('joined');
    getWithTracks.mockResolvedValue({
      id: 'p1', title: 'A', description: null, coverUrl: null, kind: 'USER',
      editorialParams: null, visibility: 'PRIVATE', ownerUserId: 'owner-1',
      likesCount: 0, isCollaborative: true, version: 1, tracks: [],
    });
    const res = await POST(req({ token: 'good-token' }), ctx);
    expect(res.status).toBe(200);
    expect(playlistJoinResponseSchema.safeParse(await res.json()).success).toBe(true);
  });
});

describe('DELETE /api/v1/playlists/[id]/collaborators (leave)', () => {
  const req = () => new Request('http://localhost/api/v1/playlists/p1/collaborators', { method: 'DELETE' });

  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await DELETE(req(), ctx)).status).toBe(401);
  });

  it('403 when the caller is not a collaborator', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'random' } } as never);
    getCollabState.mockResolvedValue(collabState);
    isCollaborator.mockResolvedValue(false);
    expect((await DELETE(req(), ctx)).status).toBe(403);
    expect(removeCollaborator).not.toHaveBeenCalled();
  });

  it('200 removes the caller as a collaborator', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getCollabState.mockResolvedValue(collabState);
    isCollaborator.mockResolvedValue(true);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    expect(removeCollaborator).toHaveBeenCalledWith('p1', 'collab-1');
    expect(okResponseSchema.safeParse(await res.json()).success).toBe(true);
  });
});

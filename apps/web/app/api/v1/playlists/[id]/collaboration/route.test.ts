import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getWithTracks, setCollaboration, getCollabState } = vi.hoisted(() => ({
  getWithTracks: vi.fn(),
  setCollaboration: vi.fn(),
  getCollabState: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@/lib/realtime', () => ({ publishChannel: vi.fn(), playlistChannel: (id: string) => `rt:playlist:${id}` }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    getWithTracks = getWithTracks;
    setCollaboration = setCollaboration;
    getCollabState = getCollabState;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

import { auth } from '@/auth';
import { GET, PATCH, POST } from './route';
const mockedAuth = vi.mocked(auth);

const ctx = { params: Promise.resolve({ id: 'p1' }) };
const getReq = () => new Request('http://localhost/api/v1/playlists/p1/collaboration');
const patchReq = (body: unknown) => new Request('http://localhost/api/v1/playlists/p1/collaboration', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const postReq = () => new Request('http://localhost/api/v1/playlists/p1/collaboration', { method: 'POST' });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/playlists/[id]/collaboration (действующая ссылка)', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await GET(getReq(), ctx)).status).toBe(401);
  });

  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue(null);
    expect((await GET(getReq(), ctx)).status).toBe(404);
  });

  it('403 when caller is not the owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'someone-else' } } as never);
    getCollabState.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: true, collabToken: 'tok' });
    expect((await GET(getReq(), ctx)).status).toBe(403);
  });

  it('отдаёт существующий токен, не выпуская новый', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: true, collabToken: 'tok' });
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).inviteUrl).toMatch(/\/playlists\/p1\?join=tok$/);
    expect(setCollaboration).not.toHaveBeenCalled();
  });

  it('null, когда совместность выключена', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: false, collabToken: null });
    const res = await GET(getReq(), ctx);
    expect((await res.json()).inviteUrl).toBeNull();
  });
});

describe('PATCH /api/v1/playlists/[id]/collaboration', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await PATCH(patchReq({ enabled: true }), ctx)).status).toBe(401);
  });

  it('400 on invalid body', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    expect((await PATCH(patchReq({ enabled: 'yes' }), ctx)).status).toBe(400);
  });

  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getWithTracks.mockResolvedValue(null);
    expect((await PATCH(patchReq({ enabled: true }), ctx)).status).toBe(404);
  });

  it('403 when caller is not the owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'someone-else' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1' });
    expect((await PATCH(patchReq({ enabled: true }), ctx)).status).toBe(403);
    expect(setCollaboration).not.toHaveBeenCalled();
  });

  it('200 enabling returns an invite URL', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1' });
    const res = await PATCH(patchReq({ enabled: true }), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isCollaborative).toBe(true);
    expect(json.inviteUrl).toMatch(/\/playlists\/p1\?join=.+$/);
    expect(setCollaboration).toHaveBeenCalledWith('p1', 'owner-1', { isCollaborative: true, collabToken: expect.any(String) });
  });

  it('200 disabling nulls the invite URL', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1' });
    const res = await PATCH(patchReq({ enabled: false }), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isCollaborative).toBe(false);
    expect(json.inviteUrl).toBeNull();
    expect(setCollaboration).toHaveBeenCalledWith('p1', 'owner-1', { isCollaborative: false, collabToken: null });
  });
});

describe('POST /api/v1/playlists/[id]/collaboration (rotate token)', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await POST(postReq(), ctx)).status).toBe(401);
  });

  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getWithTracks.mockResolvedValue(null);
    expect((await POST(postReq(), ctx)).status).toBe(404);
  });

  it('403 when caller is not the owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'someone-else' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: true });
    expect((await POST(postReq(), ctx)).status).toBe(403);
  });

  it('409 when the playlist is not collaborative', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: false });
    expect((await POST(postReq(), ctx)).status).toBe(409);
  });

  it('200 rotates the token and returns a fresh invite URL', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: true });
    const res = await POST(postReq(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.inviteUrl).toMatch(/\/playlists\/p1\?join=.+$/);
    expect(setCollaboration).toHaveBeenCalledWith('p1', 'owner-1', { isCollaborative: true, collabToken: expect.any(String) });
  });
});

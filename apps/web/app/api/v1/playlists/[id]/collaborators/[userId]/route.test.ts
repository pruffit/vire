import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getCollabState, removeCollaborator } = vi.hoisted(() => ({
  getCollabState: vi.fn(),
  removeCollaborator: vi.fn(),
}));
const { publishChannel } = vi.hoisted(() => ({ publishChannel: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@/lib/realtime', () => ({ publishChannel, playlistChannel: (id: string) => `rt:playlist:${id}` }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    getCollabState = getCollabState;
    removeCollaborator = removeCollaborator;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

import { auth } from '@/auth';
import { DELETE } from './route';
const mockedAuth = vi.mocked(auth);

const ctx = { params: Promise.resolve({ id: 'p1', userId: 'collab-1' }) };
const req = () => new Request('http://localhost/api/v1/playlists/p1/collaborators/collab-1', { method: 'DELETE' });

beforeEach(() => vi.clearAllMocks());

describe('DELETE /api/v1/playlists/[id]/collaborators/[userId] (kick)', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await DELETE(req(), ctx)).status).toBe(401);
  });

  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue(null);
    expect((await DELETE(req(), ctx)).status).toBe(404);
  });

  it('403 when caller is not the owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'someone-else' } } as never);
    getCollabState.mockResolvedValue({ isCollaborative: true, collabToken: 'x', version: 0, ownerUserId: 'owner-1' });
    expect((await DELETE(req(), ctx)).status).toBe(403);
    expect(removeCollaborator).not.toHaveBeenCalled();
  });

  it('не рассылает событие, если участника и не было', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue({ isCollaborative: true, collabToken: 'x', version: 0, ownerUserId: 'owner-1' });
    removeCollaborator.mockResolvedValue(false);
    expect((await DELETE(req(), ctx)).status).toBe(200);
    expect(publishChannel).not.toHaveBeenCalled();
  });

  it('200 the owner kicks a collaborator', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue({ isCollaborative: true, collabToken: 'x', version: 0, ownerUserId: 'owner-1' });
    removeCollaborator.mockResolvedValue(true);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    expect(removeCollaborator).toHaveBeenCalledWith('p1', 'collab-1');
    expect(publishChannel).toHaveBeenCalledWith('rt:playlist:p1', { type: 'playlist:collaborators', playlistId: 'p1', actorId: 'owner-1' });
  });
});

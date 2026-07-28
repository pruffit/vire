import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getWithTracks, removeTrack, isCollaborator, getTrackAddedBy } = vi.hoisted(() => ({
  getWithTracks: vi.fn(),
  removeTrack: vi.fn(),
  isCollaborator: vi.fn(),
  getTrackAddedBy: vi.fn(),
}));
const { publishChannel } = vi.hoisted(() => ({ publishChannel: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@/lib/realtime', () => ({ publishChannel, playlistChannel: (id: string) => `rt:playlist:${id}` }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    getWithTracks = getWithTracks;
    removeTrack = removeTrack;
    isCollaborator = isCollaborator;
    getTrackAddedBy = getTrackAddedBy;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

import { auth } from '@/auth';
import { DELETE } from './route';
const mockedAuth = vi.mocked(auth);

const ctx = { params: Promise.resolve({ id: 'p1', trackId: 't1' }) };
const req = () => new Request('http://localhost/api/v1/playlists/p1/tracks/t1', { method: 'DELETE' });

beforeEach(() => vi.clearAllMocks());

describe('DELETE /api/v1/playlists/[id]/tracks/[trackId]', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await DELETE(req(), ctx)).status).toBe(401);
  });

  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue(null);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(404);
    expect(removeTrack).not.toHaveBeenCalled();
  });

  it('403 when not owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'other', isCollaborative: false });
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(403);
    expect(removeTrack).not.toHaveBeenCalled();
  });

  it('200 removes the track', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1', isCollaborative: false });
    removeTrack.mockResolvedValue(5);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    expect(removeTrack).toHaveBeenCalledWith('p1', 't1');
    expect(publishChannel).toHaveBeenCalledWith('rt:playlist:p1', { type: 'playlist:changed', playlistId: 'p1', version: 5, actorId: 'u1' });
  });

  it('a collaborator can remove their own added track', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: true });
    isCollaborator.mockResolvedValue(true);
    getTrackAddedBy.mockResolvedValue('collab-1');
    removeTrack.mockResolvedValue(6);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    expect(removeTrack).toHaveBeenCalledWith('p1', 't1');
  });

  it('403 when a collaborator tries to remove a track added by someone else', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: true });
    isCollaborator.mockResolvedValue(true);
    getTrackAddedBy.mockResolvedValue('someone-else');
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(403);
    expect(removeTrack).not.toHaveBeenCalled();
  });

  it('the owner can remove a track added by a collaborator', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'owner-1', isCollaborative: true });
    getTrackAddedBy.mockResolvedValue('collab-1');
    removeTrack.mockResolvedValue(7);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    expect(getTrackAddedBy).not.toHaveBeenCalled();
    expect(removeTrack).toHaveBeenCalledWith('p1', 't1');
  });
});

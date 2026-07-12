import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getWithTracks, removeTrack } = vi.hoisted(() => ({
  getWithTracks: vi.fn(),
  removeTrack: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    getWithTracks = getWithTracks;
    removeTrack = removeTrack;
  },
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
    getWithTracks.mockResolvedValue({ ownerUserId: 'other' });
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(403);
    expect(removeTrack).not.toHaveBeenCalled();
  });

  it('200 removes the track', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    expect(removeTrack).toHaveBeenCalledWith('p1', 't1');
  });
});

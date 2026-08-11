import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playlistPageResponseSchema } from '@vire/api-contracts';

const { getPage } = vi.hoisted(() => ({ getPage: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist', () => ({ playlistService: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistPageRepository: class {},
}));
vi.mock('@vire/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vire/core')>();
  return {
    ...actual,
    PlaylistPageService: class {
      getPage = getPage;
    },
  };
});

import { auth } from '@/auth';
import { NotFoundError, ForbiddenError } from '@vire/core';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const ctx = { params: Promise.resolve({ id: 'p1' }) };
const req = (join?: string) => new Request(`http://localhost/api/v1/playlists/p1/page${join ? `?join=${join}` : ''}`);

const mockPlaylist = {
  id: 'p1',
  title: 'My Playlist',
  description: null,
  coverUrl: null,
  kind: 'USER',
  editorialParams: null,
  visibility: 'PRIVATE' as const,
  ownerUserId: 'owner-1',
  likesCount: 0,
  isCollaborative: true,
  version: 0,
  tracks: [],
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/playlists/[id]/page', () => {
  it('200 for the owner: role OWNER, response parses against the contract', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getPage.mockResolvedValue({
      ok: true,
      value: { kind: 'playlist', playlist: mockPlaylist, role: 'OWNER', collaborators: [], liked: false, invite: null, inviterName: null },
    });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = playlistPageResponseSchema.parse(body);
    if (parsed.kind !== 'playlist') throw new Error('expected playlist view');
    expect(parsed.role).toBe('OWNER');
    expect(getPage).toHaveBeenCalledWith({ playlistId: 'p1', viewerId: 'owner-1', joinToken: undefined });
  });

  it('200 for a collaborator: role COLLABORATOR, collaborators + joinedAt serialized to ISO', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'collab-1' } } as never);
    getPage.mockResolvedValue({
      ok: true,
      value: {
        kind: 'playlist',
        playlist: mockPlaylist,
        role: 'COLLABORATOR',
        collaborators: [{ userId: 'collab-1', name: 'Collab', image: null, joinedAt: new Date('2024-01-01T00:00:00.000Z') }],
        liked: true,
        invite: null,
        inviterName: null,
      },
    });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = playlistPageResponseSchema.parse(body);
    if (parsed.kind !== 'playlist') throw new Error('expected playlist view');
    expect(parsed.role).toBe('COLLABORATOR');
    expect(parsed.collaborators).toEqual([{ userId: 'collab-1', name: 'Collab', image: null, joinedAt: '2024-01-01T00:00:00.000Z' }]);
    expect(parsed.liked).toBe(true);
  });

  it('200 for an outsider viewer: role VIEWER, no collaborators', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'outsider-1' } } as never);
    getPage.mockResolvedValue({
      ok: true,
      value: { kind: 'playlist', playlist: { ...mockPlaylist, visibility: 'PUBLIC' }, role: 'VIEWER', collaborators: [], liked: false, invite: null, inviterName: null },
    });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = playlistPageResponseSchema.parse(body);
    if (parsed.kind !== 'playlist') throw new Error('expected playlist view');
    expect(parsed.role).toBe('VIEWER');
    expect(parsed.collaborators).toEqual([]);
  });

  it('200 for an anonymous viewer with a valid join token: kind invite, no track data in body', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getPage.mockResolvedValue({ ok: true, value: { kind: 'invite', title: 'Друзья слушают', ownerUserId: 'owner-1' } });
    const res = await GET(req('tok'), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = playlistPageResponseSchema.parse(body);
    expect(parsed).toEqual({ kind: 'invite', title: 'Друзья слушают', ownerUserId: 'owner-1' });
    expect('playlist' in parsed).toBe(false);
    expect(getPage).toHaveBeenCalledWith({ playlistId: 'p1', viewerId: null, joinToken: 'tok' });
  });

  it('404 for an anonymous viewer without a token on a private playlist', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getPage.mockResolvedValue({ ok: false, error: new NotFoundError('Playlist', 'p1', 'playlist.notFound') });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Playlist not found: p1', code: 'playlist.notFound' });
  });

  it('403 for a forbidden viewer', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'outsider-1' } } as never);
    getPage.mockResolvedValue({ ok: false, error: new ForbiddenError('nope', 'playlist.forbidden') });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(403);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { PlaylistPageService, type IPlaylistPageAccess } from './playlist-page';
import { ok, err, NotFoundError, ForbiddenError } from '../../../errors';
import type { IPlaylistPageRepository } from '../repositories/playlist-page';
import type { PlaylistWithTracks, PlaylistCollaborator } from '../types/playlist';

const mockPlaylist: PlaylistWithTracks = {
  id: 'p1',
  title: 'My Playlist',
  description: null,
  coverUrl: null,
  kind: 'USER',
  editorialParams: null,
  visibility: 'PUBLIC',
  ownerUserId: 'owner-1',
  likesCount: 0,
  isCollaborative: false,
  version: 0,
  tracks: [],
};

const mockCollaborators: PlaylistCollaborator[] = [
  { userId: 'collab-1', name: 'Collab', image: null, joinedAt: new Date('2024-01-01') },
];

function makeAccess(overrides?: Partial<IPlaylistPageAccess>): IPlaylistPageAccess {
  return {
    getForViewer: vi.fn().mockResolvedValue(ok(mockPlaylist)),
    checkInvite: vi.fn().mockResolvedValue(err(new NotFoundError('Playlist', 'p1', 'playlist.notFound'))),
    listCollaborators: vi.fn().mockResolvedValue(ok([])),
    ...overrides,
  };
}

function makeRepo(overrides?: Partial<IPlaylistPageRepository>): IPlaylistPageRepository {
  return {
    likeState: vi.fn().mockResolvedValue(false),
    userName: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('PlaylistPageService.getPage — роль и состав', () => {
  it('owner: role OWNER, collaborators запрошены, liked/userName не запрашиваются', async () => {
    const access = makeAccess({ listCollaborators: vi.fn().mockResolvedValue(ok(mockCollaborators)) });
    const repo = makeRepo();
    const service = new PlaylistPageService(access, repo);

    const result = await service.getPage({ playlistId: 'p1', viewerId: 'owner-1' });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'playlist') throw new Error('expected playlist view');
    expect(result.value.role).toBe('OWNER');
    expect(result.value.collaborators).toEqual(mockCollaborators);
    expect(result.value.liked).toBe(false);
    expect(access.listCollaborators).toHaveBeenCalledWith('p1', 'owner-1');
    expect(repo.likeState).not.toHaveBeenCalled();
    expect(repo.userName).not.toHaveBeenCalled();
  });

  it('collaborator: role COLLABORATOR, liked запрошен, баннера нет — userName не запрашивается', async () => {
    const collabPlaylist = { ...mockPlaylist, isCollaborative: true };
    const access = makeAccess({
      getForViewer: vi.fn().mockResolvedValue(ok(collabPlaylist)),
      listCollaborators: vi.fn().mockResolvedValue(ok(mockCollaborators)),
    });
    const repo = makeRepo({ likeState: vi.fn().mockResolvedValue(true) });
    const service = new PlaylistPageService(access, repo);

    const result = await service.getPage({ playlistId: 'p1', viewerId: 'collab-1' });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'playlist') throw new Error('expected playlist view');
    expect(result.value.role).toBe('COLLABORATOR');
    expect(result.value.collaborators).toEqual(mockCollaborators);
    expect(result.value.liked).toBe(true);
    expect(repo.likeState).toHaveBeenCalledWith('collab-1', 'p1');
    expect(repo.userName).not.toHaveBeenCalled();
  });

  it('посторонний вошедший на некооперативном плейлисте: role VIEWER, listCollaborators не зовётся', async () => {
    const access = makeAccess();
    const repo = makeRepo({ likeState: vi.fn().mockResolvedValue(false) });
    const service = new PlaylistPageService(access, repo);

    const result = await service.getPage({ playlistId: 'p1', viewerId: 'outsider-1' });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'playlist') throw new Error('expected playlist view');
    expect(result.value.role).toBe('VIEWER');
    expect(result.value.collaborators).toEqual([]);
    expect(access.listCollaborators).not.toHaveBeenCalled();
    expect(repo.likeState).toHaveBeenCalledWith('outsider-1', 'p1');
  });
});

describe('PlaylistPageService.getPage — экран приглашения', () => {
  it('аноним с валидным токеном получает kind: invite без состава плейлиста', async () => {
    const access = makeAccess({
      checkInvite: vi.fn().mockResolvedValue(ok({ title: 'Друзья слушают', ownerUserId: 'owner-1' })),
      getForViewer: vi.fn().mockResolvedValue(err(new ForbiddenError('nope', 'playlist.forbidden'))),
    });
    const repo = makeRepo();
    const service = new PlaylistPageService(access, repo);

    const result = await service.getPage({ playlistId: 'p1', viewerId: null, joinToken: 'tok' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toEqual({ kind: 'invite', title: 'Друзья слушают', ownerUserId: 'owner-1' });
    expect(access.listCollaborators).not.toHaveBeenCalled();
    expect(repo.likeState).not.toHaveBeenCalled();
    expect(repo.userName).not.toHaveBeenCalled();
  });

  it('аноним без токена на приватном — ошибка getForViewer прокидывается, checkInvite не зовётся', async () => {
    const access = makeAccess({
      getForViewer: vi.fn().mockResolvedValue(err(new NotFoundError('Playlist', 'p1', 'playlist.notFound'))),
    });
    const repo = makeRepo();
    const service = new PlaylistPageService(access, repo);

    const result = await service.getPage({ playlistId: 'p1', viewerId: null });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error).toBeInstanceOf(NotFoundError);
    expect(access.checkInvite).not.toHaveBeenCalled();
  });

  it('вошедший посторонний с токеном при отказе getForViewer получает ошибку, не экран приглашения', async () => {
    const access = makeAccess({
      checkInvite: vi.fn().mockResolvedValue(ok({ title: 'X', ownerUserId: 'owner-1' })),
      getForViewer: vi.fn().mockResolvedValue(err(new ForbiddenError('nope', 'playlist.forbidden'))),
    });
    const repo = makeRepo();
    const service = new PlaylistPageService(access, repo);

    const result = await service.getPage({ playlistId: 'p1', viewerId: 'outsider-1', joinToken: 'tok' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('баннер реально показывается: коллаборативный + invite + role VIEWER — inviterName запрошен', async () => {
    const collabPlaylist = { ...mockPlaylist, isCollaborative: true };
    const access = makeAccess({
      checkInvite: vi.fn().mockResolvedValue(ok({ title: 'X', ownerUserId: 'owner-1' })),
      getForViewer: vi.fn().mockResolvedValue(ok(collabPlaylist)),
      listCollaborators: vi.fn().mockResolvedValue(err(new ForbiddenError('nope', 'playlist.forbidden'))),
    });
    const repo = makeRepo({ userName: vi.fn().mockResolvedValue('Alice') });
    const service = new PlaylistPageService(access, repo);

    const result = await service.getPage({ playlistId: 'p1', viewerId: 'viewer-1', joinToken: 'tok' });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'playlist') throw new Error('expected playlist view');
    expect(result.value.role).toBe('VIEWER');
    expect(result.value.invite).toEqual({ title: 'X', ownerUserId: 'owner-1' });
    expect(result.value.inviterName).toBe('Alice');
    expect(repo.userName).toHaveBeenCalledWith('owner-1');
  });
});

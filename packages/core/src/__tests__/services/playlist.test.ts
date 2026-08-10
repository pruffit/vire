import { describe, it, expect, vi } from 'vitest';
import { PlaylistService, PLAYLIST_MAX_COLLABORATORS } from '../../services/playlist';
import { NotFoundError, ConflictError, ForbiddenError } from '../../errors';
import type { IPlaylistRepository, IPlaylistCoverStorage } from '../../repositories/playlist';
import type { IBlockRepository } from '../../repositories/block';
import type { INotificationRepository } from '../../repositories/notification';
import type { IPlaylistBroadcaster } from '../../ports/playlist-realtime';
import type { PlaylistSummary, PlaylistWithTracks, PlaylistSuggestions, PlaylistCollaborator } from '../../types/playlist';

const mockSummary: PlaylistSummary = {
  id: 'p1',
  title: 'My Playlist',
  visibility: 'PRIVATE',
  trackCount: 0,
  coverUrl: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPlaylist: PlaylistWithTracks = {
  id: 'p1',
  title: 'My Playlist',
  description: null,
  coverUrl: null,
  kind: 'USER',
  editorialParams: null,
  visibility: 'PRIVATE',
  ownerUserId: 'owner-1',
  likesCount: 0,
  isCollaborative: false,
  version: 0,
  tracks: [
    {
      id: 't1',
      title: 'Track One',
      durationSec: 200,
      position: 0,
      artistName: 'Artist',
      artistSlug: 'artist',
      releaseId: 'r1',
      coverUrl: null,
      accentColor: null,
      isExplicit: false,
      version: null,
      feat: [],
      addedBy: null,
    },
  ],
};

function makeRepo(overrides?: Partial<IPlaylistRepository>): IPlaylistRepository {
  return {
    listByUser: vi.fn().mockResolvedValue([]),
    trackMembership: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(mockSummary),
    getWithTracks: vi.fn().mockResolvedValue(mockPlaylist),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
    addTrack: vi.fn().mockResolvedValue(1),
    removeTrack: vi.fn().mockResolvedValue(1),
    reorder: vi.fn().mockResolvedValue(1),
    setCover: vi.fn().mockResolvedValue(undefined),
    searchTracks: vi.fn().mockResolvedValue([]),
    suggestions: vi.fn().mockResolvedValue({ liked: [], recent: [], similar: [] } satisfies PlaylistSuggestions),
    getLikeState: vi.fn().mockResolvedValue(false),
    like: vi.fn().mockResolvedValue(undefined),
    unlike: vi.fn().mockResolvedValue(undefined),
    trackExists: vi.fn().mockResolvedValue(true),
    adminUpdate: vi.fn().mockResolvedValue(undefined),
    adminDelete: vi.fn().mockResolvedValue(undefined),
    listCollaborators: vi.fn().mockResolvedValue([]),
    isCollaborator: vi.fn().mockResolvedValue(false),
    joinCollaborator: vi.fn().mockResolvedValue('joined'),
    removeCollaborator: vi.fn().mockResolvedValue(true),
    setCollaboration: vi.fn().mockResolvedValue(undefined),
    getCollabState: vi.fn().mockResolvedValue({
      isCollaborative: false, collabToken: null, version: 0, ownerUserId: 'owner-1',
    }),
    getInvitePreview: vi.fn().mockResolvedValue(null),
    getTrackAddedBy: vi.fn().mockResolvedValue(null),
    removeMembershipBetween: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeStorage(overrides?: Partial<IPlaylistCoverStorage>): IPlaylistCoverStorage {
  return {
    upload: vi.fn().mockResolvedValue('https://cdn.example/playlists/p1.jpg'),
    ...overrides,
  };
}

function makeBlocks(overrides?: Partial<IBlockRepository>): IBlockRepository {
  return {
    block: vi.fn().mockResolvedValue(undefined),
    unblock: vi.fn().mockResolvedValue(undefined),
    existsEitherWay: vi.fn().mockResolvedValue(false),
    existsDirected: vi.fn().mockResolvedValue(false),
    listBlocked: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeNotifications(overrides?: Partial<INotificationRepository>): INotificationRepository {
  return {
    insert: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    countUnread: vi.fn().mockResolvedValue(0),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeBroadcaster(overrides?: Partial<IPlaylistBroadcaster>): IPlaylistBroadcaster {
  return {
    broadcast: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;

function makeService(
  repo: IPlaylistRepository,
  storage: IPlaylistCoverStorage = makeStorage(),
  deps?: {
    blocks?: IBlockRepository;
    notifications?: INotificationRepository;
    broadcaster?: IPlaylistBroadcaster;
    uuid?: () => string;
  },
) {
  return new PlaylistService(
    repo,
    storage,
    () => NOW,
    deps?.blocks ?? makeBlocks(),
    deps?.notifications ?? makeNotifications(),
    deps?.broadcaster ?? makeBroadcaster(),
    deps?.uuid ?? (() => 'token-1'),
  );
}

describe('PlaylistService.listForUser', () => {
  it('returns only playlists when trackId is not given', async () => {
    const repo = makeRepo({ listByUser: vi.fn().mockResolvedValue([mockSummary]) });
    const service = makeService(repo);

    const result = await service.listForUser('user-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.playlists).toEqual([mockSummary]);
      expect(result.value.inPlaylists).toBeUndefined();
    }
    expect(repo.trackMembership).not.toHaveBeenCalled();
  });

  it('includes inPlaylists when trackId is given', async () => {
    const repo = makeRepo({ trackMembership: vi.fn().mockResolvedValue(['p1']) });
    const service = makeService(repo);

    const result = await service.listForUser('user-1', 't1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.inPlaylists).toEqual(['p1']);
    expect(repo.trackMembership).toHaveBeenCalledWith('user-1', 't1');
  });
});

describe('PlaylistService.create', () => {
  it('creates and returns the summary from repo', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.create('user-1', 'New Playlist');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(mockSummary);
    expect(repo.create).toHaveBeenCalledWith('user-1', 'New Playlist');
  });
});

describe('PlaylistService.getForViewer', () => {
  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getWithTracks: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.getForViewer('missing', null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('allows the owner to view a PRIVATE playlist', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.getForViewer('p1', 'owner-1');

    expect(result.ok).toBe(true);
  });

  it('forbids a non-owner from viewing a PRIVATE playlist', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.getForViewer('p1', 'someone-else');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
  });

  it('forbids an anonymous viewer from viewing a PRIVATE playlist', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.getForViewer('p1', null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
  });

  it('allows anyone to view a PUBLIC playlist', async () => {
    const repo = makeRepo({ getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, visibility: 'PUBLIC' }) });
    const service = makeService(repo);

    const anon = await service.getForViewer('p1', null);
    const other = await service.getForViewer('p1', 'someone-else');

    expect(anon.ok).toBe(true);
    expect(other.ok).toBe(true);
  });

  it('allows a collaborator to view a PRIVATE collaborative playlist', async () => {
    const repo = makeRepo({
      getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }),
      isCollaborator: vi.fn().mockResolvedValue(true),
    });
    const service = makeService(repo);

    const result = await service.getForViewer('p1', 'collab-1');

    expect(result.ok).toBe(true);
  });

  it('allows an authenticated viewer with a valid join token into a PRIVATE collaborative playlist', async () => {
    const repo = makeRepo({
      getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }),
      getCollabState: vi.fn().mockResolvedValue({ isCollaborative: true, collabToken: 'good-token', version: 0, ownerUserId: 'owner-1' }),
    });
    const service = makeService(repo);

    const result = await service.getForViewer('p1', 'invited-1', 'good-token');

    expect(result.ok).toBe(true);
  });

  it('не отдаёт состав анониму даже по валидному токену', async () => {
    const repo = makeRepo({
      getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }),
      getCollabState: vi.fn().mockResolvedValue({ isCollaborative: true, collabToken: 'good-token', version: 0, ownerUserId: 'owner-1' }),
    });
    const service = makeService(repo);

    const result = await service.getForViewer('p1', null, 'good-token');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('forbids access via an invalid join token', async () => {
    const repo = makeRepo({
      getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }),
      getCollabState: vi.fn().mockResolvedValue({ isCollaborative: true, collabToken: 'good-token', version: 0, ownerUserId: 'owner-1' }),
    });
    const service = makeService(repo);

    const result = await service.getForViewer('p1', null, 'wrong-token');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
  });
});

describe('PlaylistService.update', () => {
  it('trims title and description before delegating to repo', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.update('p1', 'owner-1', { title: '  New Title  ', description: '  desc  ' });

    expect(result.ok).toBe(true);
    expect(repo.update).toHaveBeenCalledWith('p1', 'owner-1', { title: 'New Title', description: 'desc' });
  });

  it('passes null description through without trimming', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    await service.update('p1', 'owner-1', { description: null });

    expect(repo.update).toHaveBeenCalledWith('p1', 'owner-1', { description: null });
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getWithTracks: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.update('missing', 'owner-1', { title: 'x' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when caller is not the owner', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.update('p1', 'someone-else', { title: 'x' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('PlaylistService.delete', () => {
  it('returns ok when repo deletes successfully', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.delete('p1', 'owner-1');

    expect(result.ok).toBe(true);
  });

  it('returns err(NotFoundError) when repo returns false (not found or not owner)', async () => {
    const repo = makeRepo({ delete: vi.fn().mockResolvedValue(false) });
    const service = makeService(repo);

    const result = await service.delete('p1', 'someone-else');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });
});

describe('PlaylistService no-op мутации', () => {
  it('не рассылает playlist:changed, когда трек уже был в плейлисте', async () => {
    const broadcaster = makeBroadcaster();
    const repo = makeRepo({ addTrack: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo, undefined, { broadcaster });

    const result = await service.addTrack('p1', 'owner-1', 't2');

    expect(result.ok).toBe(true);
    expect(broadcaster.broadcast).not.toHaveBeenCalled();
  });

  it('не рассылает playlist:changed, когда удалять было нечего', async () => {
    const broadcaster = makeBroadcaster();
    const repo = makeRepo({ removeTrack: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo, undefined, { broadcaster });

    const result = await service.removeTrack('p1', 'owner-1', 't9');

    expect(result.ok).toBe(true);
    expect(broadcaster.broadcast).not.toHaveBeenCalled();
  });
});

describe('PlaylistService.checkInvite', () => {
  const preview = {
    title: 'Секретный плейлист',
    ownerUserId: 'owner-1',
    isCollaborative: true,
    collabToken: 'good-token',
  };

  it('отдаёт превью по валидному токену — без состава треков', async () => {
    const repo = makeRepo({ getInvitePreview: vi.fn().mockResolvedValue(preview) });
    const service = makeService(repo);

    const result = await service.checkInvite('p1', 'good-token');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ title: 'Секретный плейлист', ownerUserId: 'owner-1' });
    expect(repo.getWithTracks).not.toHaveBeenCalled();
  });

  it('отказывает на мусорный токен', async () => {
    const repo = makeRepo({ getInvitePreview: vi.fn().mockResolvedValue(preview) });
    const service = makeService(repo);

    const result = await service.checkInvite('p1', 'garbage');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('отказывает, когда совместность выключена', async () => {
    const repo = makeRepo({
      getInvitePreview: vi.fn().mockResolvedValue({ ...preview, isCollaborative: false, collabToken: null }),
    });
    const service = makeService(repo);

    const result = await service.checkInvite('p1', 'good-token');

    expect(result.ok).toBe(false);
  });
});

describe('PlaylistService.removeMembershipBetween', () => {
  it('снимает членство и оповещает затронутые плейлисты', async () => {
    const broadcaster = makeBroadcaster();
    const repo = makeRepo({ removeMembershipBetween: vi.fn().mockResolvedValue(['p1', 'p2']) });
    const service = makeService(repo, undefined, { broadcaster });

    await service.removeMembershipBetween('owner-1', 'blocked-1');

    expect(repo.removeMembershipBetween).toHaveBeenCalledWith('owner-1', 'blocked-1');
    expect(broadcaster.broadcast).toHaveBeenCalledTimes(2);
  });
});

describe('PlaylistService.addTrack', () => {
  it('adds track when owner and track exists', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.addTrack('p1', 'owner-1', 't2');

    expect(result.ok).toBe(true);
    expect(repo.addTrack).toHaveBeenCalledWith('p1', 't2', 'owner-1');
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getWithTracks: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.addTrack('missing', 'owner-1', 't2');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.trackExists).not.toHaveBeenCalled();
  });

  it('checks ownership before track existence (403 before 404)', async () => {
    const repo = makeRepo({ trackExists: vi.fn().mockResolvedValue(false) });
    const service = makeService(repo);

    const result = await service.addTrack('p1', 'someone-else', 't2');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.trackExists).not.toHaveBeenCalled();
  });

  it('returns err(NotFoundError) when track does not exist', async () => {
    const repo = makeRepo({ trackExists: vi.fn().mockResolvedValue(false) });
    const service = makeService(repo);

    const result = await service.addTrack('p1', 'owner-1', 'missing-track');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.addTrack).not.toHaveBeenCalled();
  });

  it('allows a collaborator to add a track on a collaborative playlist', async () => {
    const repo = makeRepo({
      getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }),
      isCollaborator: vi.fn().mockResolvedValue(true),
    });
    const service = makeService(repo);

    const result = await service.addTrack('p1', 'collab-1', 't2');

    expect(result.ok).toBe(true);
    expect(repo.addTrack).toHaveBeenCalledWith('p1', 't2', 'collab-1');
  });

  it('forbids a non-collaborator on a collaborative playlist', async () => {
    const repo = makeRepo({
      getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }),
      isCollaborator: vi.fn().mockResolvedValue(false),
    });
    const service = makeService(repo);

    const result = await service.addTrack('p1', 'random', 't2');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.addTrack).not.toHaveBeenCalled();
  });

  it('broadcasts playlist:changed with the new version after a successful add', async () => {
    const broadcaster = makeBroadcaster();
    const repo = makeRepo({ addTrack: vi.fn().mockResolvedValue(3) });
    const service = makeService(repo, undefined, { broadcaster });

    await service.addTrack('p1', 'owner-1', 't2');

    expect(broadcaster.broadcast).toHaveBeenCalledWith('p1', { type: 'playlist:changed', playlistId: 'p1', version: 3, actorId: 'owner-1' });
  });
});

describe('PlaylistService.removeTrack', () => {
  it('removes track when owner', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.removeTrack('p1', 'owner-1', 't1');

    expect(result.ok).toBe(true);
    expect(repo.removeTrack).toHaveBeenCalledWith('p1', 't1');
  });

  it('returns err(Forbidden) when caller is not the owner', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.removeTrack('p1', 'someone-else', 't1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.removeTrack).not.toHaveBeenCalled();
  });

  it('owner removes a track added by a collaborator', async () => {
    const repo = makeRepo({
      getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }),
      getTrackAddedBy: vi.fn().mockResolvedValue('collab-1'),
    });
    const service = makeService(repo);

    const result = await service.removeTrack('p1', 'owner-1', 't1');

    expect(result.ok).toBe(true);
    expect(repo.removeTrack).toHaveBeenCalledWith('p1', 't1');
    expect(repo.getTrackAddedBy).not.toHaveBeenCalled();
  });

  it('a collaborator removes their own added track', async () => {
    const repo = makeRepo({
      getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }),
      isCollaborator: vi.fn().mockResolvedValue(true),
      getTrackAddedBy: vi.fn().mockResolvedValue('collab-1'),
    });
    const service = makeService(repo);

    const result = await service.removeTrack('p1', 'collab-1', 't1');

    expect(result.ok).toBe(true);
    expect(repo.removeTrack).toHaveBeenCalledWith('p1', 't1');
  });

  it('forbids a collaborator from removing a track added by someone else', async () => {
    const repo = makeRepo({
      getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }),
      isCollaborator: vi.fn().mockResolvedValue(true),
      getTrackAddedBy: vi.fn().mockResolvedValue('someone-else'),
    });
    const service = makeService(repo);

    const result = await service.removeTrack('p1', 'collab-1', 't1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
    expect(repo.removeTrack).not.toHaveBeenCalled();
  });
});

describe('PlaylistService.reorder', () => {
  it('reorders when owner and permutation matches', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.reorder('p1', 'owner-1', ['t1', 't2']);

    expect(result.ok).toBe(true);
    expect(repo.reorder).toHaveBeenCalledWith('p1', 'owner-1', ['t1', 't2']);
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getWithTracks: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.reorder('missing', 'owner-1', ['t1']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.reorder).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when caller is not the owner', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.reorder('p1', 'someone-else', ['t1']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.reorder).not.toHaveBeenCalled();
  });

  it('returns err(ConflictError) when repo reports permutation mismatch', async () => {
    const repo = makeRepo({ reorder: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.reorder('p1', 'owner-1', ['t1', 't1', 't2']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('allows a collaborator to reorder', async () => {
    const repo = makeRepo({
      getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }),
      isCollaborator: vi.fn().mockResolvedValue(true),
    });
    const service = makeService(repo);

    const result = await service.reorder('p1', 'collab-1', ['t1']);

    expect(result.ok).toBe(true);
    expect(repo.reorder).toHaveBeenCalledWith('p1', 'collab-1', ['t1']);
  });

  it('forbids a non-collaborator on a non-collaborative playlist', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.reorder('p1', 'random', ['t1']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.reorder).not.toHaveBeenCalled();
  });

  it('broadcasts playlist:changed with the new version after a successful reorder', async () => {
    const broadcaster = makeBroadcaster();
    const repo = makeRepo({ reorder: vi.fn().mockResolvedValue(7) });
    const service = makeService(repo, undefined, { broadcaster });

    await service.reorder('p1', 'owner-1', ['t1']);

    expect(broadcaster.broadcast).toHaveBeenCalledWith('p1', { type: 'playlist:changed', playlistId: 'p1', version: 7, actorId: 'owner-1' });
  });
});

describe('PlaylistService.setCover', () => {
  it('clears cover without touching storage when file is null', async () => {
    const repo = makeRepo();
    const storage = makeStorage();
    const service = makeService(repo, storage);

    const result = await service.setCover('p1', 'owner-1', null);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(repo.setCover).toHaveBeenCalledWith('p1', 'owner-1', null);
  });

  it('uploads the file and appends ?v=<now()> to the cover URL', async () => {
    const repo = makeRepo();
    const storage = makeStorage({ upload: vi.fn().mockResolvedValue('https://cdn.example/playlists/p1.jpg') });
    const service = makeService(repo, storage);
    const file = { buffer: Buffer.from('img'), contentType: 'image/jpeg', ext: 'jpg' };

    const result = await service.setCover('p1', 'owner-1', file);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(`https://cdn.example/playlists/p1.jpg?v=${NOW}`);
    expect(storage.upload).toHaveBeenCalledWith('playlists/p1.jpg', file.buffer, 'image/jpeg');
    expect(repo.setCover).toHaveBeenCalledWith('p1', 'owner-1', `https://cdn.example/playlists/p1.jpg?v=${NOW}`);
  });

  it('does not call storage.upload when caller is not the owner', async () => {
    const repo = makeRepo();
    const storage = makeStorage();
    const service = makeService(repo, storage);
    const file = { buffer: Buffer.from('img'), contentType: 'image/jpeg', ext: 'jpg' };

    const result = await service.setCover('p1', 'someone-else', file);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(storage.upload).not.toHaveBeenCalled();
    expect(repo.setCover).not.toHaveBeenCalled();
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getWithTracks: vi.fn().mockResolvedValue(null) });
    const storage = makeStorage();
    const service = makeService(repo, storage);

    const result = await service.setCover('missing', 'owner-1', null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe('PlaylistService.searchForAdding', () => {
  it('returns [] without querying repo when query is shorter than 2 chars', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.searchForAdding('p1', 'owner-1', 'a');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
    expect(repo.searchTracks).not.toHaveBeenCalled();
  });

  it('trims the query and excludes tracks already in the playlist', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    await service.searchForAdding('p1', 'owner-1', '  ab  ');

    expect(repo.searchTracks).toHaveBeenCalledWith('ab', ['t1'], 20);
  });

  it('returns err(Forbidden) when caller is not the owner', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.searchForAdding('p1', 'someone-else', 'query');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.searchTracks).not.toHaveBeenCalled();
  });
});

describe('PlaylistService.suggestions', () => {
  it('returns suggestions from repo for the owner', async () => {
    const suggestions: PlaylistSuggestions = { liked: [], recent: [], similar: [] };
    const repo = makeRepo({ suggestions: vi.fn().mockResolvedValue(suggestions) });
    const service = makeService(repo);

    const result = await service.suggestions('p1', 'owner-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(suggestions);
  });

  it('returns err(Forbidden) when caller is not the owner', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.suggestions('p1', 'someone-else');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.suggestions).not.toHaveBeenCalled();
  });
});

describe('PlaylistService.adminUpdate', () => {
  it('updates without an ownership check', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.adminUpdate('p1', { title: 'New Title', visibility: 'PUBLIC' });

    expect(result.ok).toBe(true);
    expect(repo.getWithTracks).not.toHaveBeenCalled();
    expect(repo.adminUpdate).toHaveBeenCalledWith('p1', { title: 'New Title', visibility: 'PUBLIC' });
  });

  it('returns err(ValidationError) when title is empty or exceeds 200 chars', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const empty = await service.adminUpdate('p1', { title: '   ', visibility: 'PUBLIC' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.message).toBe('Название: 1–200 символов');

    const tooLong = await service.adminUpdate('p1', { title: 'x'.repeat(201), visibility: 'PUBLIC' });
    expect(tooLong.ok).toBe(false);

    expect(repo.adminUpdate).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError) when visibility is not PRIVATE/PUBLIC', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.adminUpdate('p1', { title: 'Title', visibility: 'BOGUS' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Неверная видимость');
    expect(repo.adminUpdate).not.toHaveBeenCalled();
  });
});

describe('PlaylistService.adminDelete', () => {
  it('deletes without an ownership check', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.adminDelete('p1');

    expect(result.ok).toBe(true);
    expect(repo.getWithTracks).not.toHaveBeenCalled();
    expect(repo.adminDelete).toHaveBeenCalledWith('p1');
  });
});

describe('PlaylistService like state (no exists check)', () => {
  it('getLikeState delegates directly to repo', async () => {
    const repo = makeRepo({ getLikeState: vi.fn().mockResolvedValue(true) });
    const service = makeService(repo);

    const result = await service.getLikeState('user-1', 'p1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });

  it('like delegates directly to repo', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.like('user-1', 'p1');

    expect(result.ok).toBe(true);
    expect(repo.like).toHaveBeenCalledWith('user-1', 'p1');
  });

  it('unlike delegates directly to repo', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.unlike('user-1', 'p1');

    expect(result.ok).toBe(true);
    expect(repo.unlike).toHaveBeenCalledWith('user-1', 'p1');
  });
});

describe('PlaylistService.setCollaboration', () => {
  it('enables collaboration and generates a token', async () => {
    const repo = makeRepo();
    const service = makeService(repo, undefined, { uuid: () => 'fresh-token' });

    const result = await service.setCollaboration('p1', 'owner-1', true);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.collabToken).toBe('fresh-token');
    expect(repo.setCollaboration).toHaveBeenCalledWith('p1', 'owner-1', { isCollaborative: true, collabToken: 'fresh-token' });
  });

  it('disabling collaboration nulls the token', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.setCollaboration('p1', 'owner-1', false);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.collabToken).toBeNull();
    expect(repo.setCollaboration).toHaveBeenCalledWith('p1', 'owner-1', { isCollaborative: false, collabToken: null });
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getWithTracks: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.setCollaboration('missing', 'owner-1', true);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('returns err(Forbidden) when caller is not the owner', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.setCollaboration('p1', 'someone-else', true);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.setCollaboration).not.toHaveBeenCalled();
  });
});

describe('PlaylistService.rotateCollabToken', () => {
  it('rotates the token on a collaborative playlist', async () => {
    const repo = makeRepo({ getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }) });
    const service = makeService(repo, undefined, { uuid: () => 'rotated-token' });

    const result = await service.rotateCollabToken('p1', 'owner-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.collabToken).toBe('rotated-token');
    expect(repo.setCollaboration).toHaveBeenCalledWith('p1', 'owner-1', { isCollaborative: true, collabToken: 'rotated-token' });
  });

  it('returns err(ConflictError) when the playlist is not collaborative', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.rotateCollabToken('p1', 'owner-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('returns err(Forbidden) when caller is not the owner', async () => {
    const repo = makeRepo({ getWithTracks: vi.fn().mockResolvedValue({ ...mockPlaylist, isCollaborative: true }) });
    const service = makeService(repo);

    const result = await service.rotateCollabToken('p1', 'someone-else');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getWithTracks: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.rotateCollabToken('missing', 'owner-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });
});

const collabState = (overrides?: Partial<{ isCollaborative: boolean; collabToken: string | null; version: number; ownerUserId: string | null }>) => ({
  isCollaborative: true,
  collabToken: 'good-token',
  version: 0,
  ownerUserId: 'owner-1',
  ...overrides,
});

describe('PlaylistService.join', () => {
  it('joins with a valid token, notifies the owner and broadcasts', async () => {
    const notifications = makeNotifications();
    const broadcaster = makeBroadcaster();
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()) });
    const service = makeService(repo, undefined, { notifications, broadcaster });

    const result = await service.join('p1', 'collab-1', 'good-token');

    expect(result.ok).toBe(true);
    expect(repo.joinCollaborator).toHaveBeenCalledWith('p1', 'collab-1', 'owner-1', PLAYLIST_MAX_COLLABORATORS);
    expect(notifications.insert).toHaveBeenCalledWith('owner-1', 'PLAYLIST_COLLAB_JOIN', 'collab-1', 'p1');
    expect(broadcaster.broadcast).toHaveBeenCalledWith('p1', { type: 'playlist:collaborators', playlistId: 'p1', actorId: 'collab-1' });
  });

  it('is idempotent when the user is already a collaborator', async () => {
    const notifications = makeNotifications();
    const broadcaster = makeBroadcaster();
    const repo = makeRepo({
      getCollabState: vi.fn().mockResolvedValue(collabState()),
      isCollaborator: vi.fn().mockResolvedValue(true),
      joinCollaborator: vi.fn().mockResolvedValue('already'),
    });
    const service = makeService(repo, undefined, { notifications, broadcaster });

    const result = await service.join('p1', 'collab-1', 'good-token');

    expect(result.ok).toBe(true);
    expect(notifications.insert).not.toHaveBeenCalled();
    expect(broadcaster.broadcast).not.toHaveBeenCalled();
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.join('missing', 'collab-1', 'good-token');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('returns err(Forbidden) when the playlist is not collaborative', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState({ isCollaborative: false })) });
    const service = makeService(repo);

    const result = await service.join('p1', 'collab-1', 'good-token');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('returns err(Forbidden) on an invalid token', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()) });
    const service = makeService(repo);

    const result = await service.join('p1', 'collab-1', 'wrong-token');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
    expect(repo.joinCollaborator).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when the caller is the owner', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()) });
    const service = makeService(repo);

    const result = await service.join('p1', 'owner-1', 'good-token');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('returns err(Forbidden) when there is a block either way with the owner', async () => {
    const blocks = makeBlocks({ existsEitherWay: vi.fn().mockResolvedValue(true) });
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()) });
    const service = makeService(repo, undefined, { blocks });

    const result = await service.join('p1', 'collab-1', 'good-token');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
    expect(repo.joinCollaborator).not.toHaveBeenCalled();
  });

  it('returns err(ConflictError) when the playlist is at the collaborator cap', async () => {
    const repo = makeRepo({
      getCollabState: vi.fn().mockResolvedValue(collabState()),
      joinCollaborator: vi.fn().mockResolvedValue('full'),
    });
    const notifications = makeNotifications();
    const service = makeService(repo, undefined, { notifications });

    const result = await service.join('p1', 'collab-1', 'good-token');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(notifications.insert).not.toHaveBeenCalled();
  });
});

describe('PlaylistService.leave', () => {
  it('removes the caller as a collaborator', async () => {
    const repo = makeRepo({
      getCollabState: vi.fn().mockResolvedValue(collabState()),
      isCollaborator: vi.fn().mockResolvedValue(true),
    });
    const service = makeService(repo);

    const result = await service.leave('p1', 'collab-1');

    expect(result.ok).toBe(true);
    expect(repo.removeCollaborator).toHaveBeenCalledWith('p1', 'collab-1');
  });

  it('returns err(Forbidden) when the caller is not a collaborator', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()) });
    const service = makeService(repo);

    const result = await service.leave('p1', 'random');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.removeCollaborator).not.toHaveBeenCalled();
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.leave('missing', 'collab-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });
});

describe('PlaylistService.kick', () => {
  it('lets the owner remove a collaborator', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()) });
    const service = makeService(repo);

    const result = await service.kick('p1', 'owner-1', 'collab-1');

    expect(result.ok).toBe(true);
    expect(repo.removeCollaborator).toHaveBeenCalledWith('p1', 'collab-1');
  });

  it('returns err(Forbidden) when caller is not the owner', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()) });
    const service = makeService(repo);

    const result = await service.kick('p1', 'someone-else', 'collab-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.removeCollaborator).not.toHaveBeenCalled();
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.kick('missing', 'owner-1', 'collab-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });
});

describe('PlaylistService.listCollaborators', () => {
  const collaborators: PlaylistCollaborator[] = [{ userId: 'collab-1', name: 'Collab', image: null, joinedAt: new Date('2026-01-01') }];

  it('lets the owner list collaborators', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()), listCollaborators: vi.fn().mockResolvedValue(collaborators) });
    const service = makeService(repo);

    const result = await service.listCollaborators('p1', 'owner-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(collaborators);
  });

  it('lets a collaborator list collaborators', async () => {
    const repo = makeRepo({
      getCollabState: vi.fn().mockResolvedValue(collabState()),
      isCollaborator: vi.fn().mockResolvedValue(true),
      listCollaborators: vi.fn().mockResolvedValue(collaborators),
    });
    const service = makeService(repo);

    const result = await service.listCollaborators('p1', 'collab-1');

    expect(result.ok).toBe(true);
  });

  it('returns err(Forbidden) for a stranger', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()) });
    const service = makeService(repo);

    const result = await service.listCollaborators('p1', 'random');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.listCollaborators('missing', 'owner-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });
});

describe('PlaylistService.assertStreamAccess', () => {
  it('allows the owner on a collaborative playlist', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()) });
    const service = makeService(repo);

    const result = await service.assertStreamAccess('p1', 'owner-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.version).toBe(0);
  });

  it('allows a collaborator on a collaborative playlist', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()), isCollaborator: vi.fn().mockResolvedValue(true) });
    const service = makeService(repo);

    const result = await service.assertStreamAccess('p1', 'collab-1');

    expect(result.ok).toBe(true);
  });

  it('forbids access when the playlist is not collaborative', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState({ isCollaborative: false })) });
    const service = makeService(repo);

    const result = await service.assertStreamAccess('p1', 'owner-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
  });

  it('forbids a non-member', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(collabState()) });
    const service = makeService(repo);

    const result = await service.assertStreamAccess('p1', 'random');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
  });

  it('returns err(NotFoundError) when playlist is missing', async () => {
    const repo = makeRepo({ getCollabState: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    const result = await service.assertStreamAccess('missing', 'owner-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });
});

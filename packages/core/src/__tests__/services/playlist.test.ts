import { describe, it, expect, vi } from 'vitest';
import { PlaylistService } from '../../services/playlist';
import { NotFoundError, ConflictError } from '../../errors';
import type { IPlaylistRepository, IPlaylistCoverStorage } from '../../repositories/playlist';
import type { PlaylistSummary, PlaylistWithTracks, PlaylistSuggestions } from '../../types/playlist';

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
  visibility: 'PRIVATE',
  ownerUserId: 'owner-1',
  likesCount: 0,
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
    addTrack: vi.fn().mockResolvedValue(undefined),
    removeTrack: vi.fn().mockResolvedValue(undefined),
    reorder: vi.fn().mockResolvedValue(true),
    setCover: vi.fn().mockResolvedValue(undefined),
    searchTracks: vi.fn().mockResolvedValue([]),
    suggestions: vi.fn().mockResolvedValue({ liked: [], recent: [], similar: [] } satisfies PlaylistSuggestions),
    getLikeState: vi.fn().mockResolvedValue(false),
    like: vi.fn().mockResolvedValue(undefined),
    unlike: vi.fn().mockResolvedValue(undefined),
    trackExists: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeStorage(overrides?: Partial<IPlaylistCoverStorage>): IPlaylistCoverStorage {
  return {
    upload: vi.fn().mockResolvedValue('https://cdn.example/playlists/p1.jpg'),
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;

function makeService(repo: IPlaylistRepository, storage: IPlaylistCoverStorage = makeStorage()) {
  return new PlaylistService(repo, storage, () => NOW);
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
    const repo = makeRepo({ reorder: vi.fn().mockResolvedValue(false) });
    const service = makeService(repo);

    const result = await service.reorder('p1', 'owner-1', ['t1', 't1', 't2']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
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

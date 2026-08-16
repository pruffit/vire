import { describe, it, expect, vi } from 'vitest';
import { ReleaseService } from './release';
import { NotFoundError, ValidationError } from '../../../errors';
import type { IReleaseRepository } from '../repositories/release';
import type { IFileUploader } from '../../../platform/storage/repositories/storage';
import type { INotifyReleaseQueue } from './release';
import type { Release, ReleaseWithTracks } from '../types/release';

const mockRelease: Release = {
  id: 'release-1',
  artistProfileId: 'artist-1',
  title: 'Test Album',
  type: 'ALBUM',
  coverUrl: null,
  releaseDate: new Date('2024-06-01'),
  status: 'PUBLISHED',
  description: null,
  linerNotes: null,
  genre: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockReleaseWithTracks: ReleaseWithTracks = {
  release: mockRelease,
  tracks: [
    {
      id: 'track-1',
      releaseId: 'release-1',
      title: 'Track One',
      version: null,
      trackNumber: 1,
      durationSec: 210,
      status: 'READY',
      isExclusive: false,
      isWip: false,
      isExplicit: false,
      credits: [],
      lyrics: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
};

function makeRepo(overrides?: Partial<IReleaseRepository>): IReleaseRepository {
  return {
    findById: vi.fn(),
    findWithTracks: vi.fn(),
    findPublishedByArtist: vi.fn(),
    findAllByArtist: vi.fn(),
    create: vi.fn().mockResolvedValue(mockRelease),
    update: vi.fn().mockResolvedValue(mockRelease),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ReleaseService.getWithTracks', () => {
  it('returns ok(releaseWithTracks) when release exists', async () => {
    const repo = makeRepo({ findWithTracks: vi.fn().mockResolvedValue(mockReleaseWithTracks) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.getWithTracks('release-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.release.id).toBe('release-1');
      expect(result.value.tracks).toHaveLength(1);
    }
  });

  it('returns err(NotFoundError) when release is null', async () => {
    const repo = makeRepo({ findWithTracks: vi.fn().mockResolvedValue(null) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.getWithTracks('non-existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error.message).toContain('non-existent');
    }
  });
});

describe('ReleaseService.getPublishedByArtist', () => {
  it('returns list from repo', async () => {
    const releases = [mockRelease];
    const repo = makeRepo({ findPublishedByArtist: vi.fn().mockResolvedValue(releases) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.getPublishedByArtist('artist-1');

    expect(result).toBe(releases);
    expect(repo.findPublishedByArtist).toHaveBeenCalledWith('artist-1');
  });

  it('returns empty array when artist has no published releases', async () => {
    const repo = makeRepo({ findPublishedByArtist: vi.fn().mockResolvedValue([]) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.getPublishedByArtist('artist-no-releases');

    expect(result).toEqual([]);
  });
});

describe('ReleaseService.deleteRelease', () => {
  it('returns ok when release exists and belongs to artist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.deleteRelease({ releaseId: 'release-1', artistProfileId: 'artist-1' });

    expect(result.ok).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith('release-1');
  });

  it('returns err(NotFoundError) when release does not exist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.deleteRelease({ releaseId: 'missing', artistProfileId: 'artist-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when release belongs to another artist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, artistProfileId: 'other-artist' }) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.deleteRelease({ releaseId: 'release-1', artistProfileId: 'artist-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('calls repo.delete with correct id', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    await service.deleteRelease({ releaseId: 'release-1', artistProfileId: 'artist-1' });

    expect(repo.delete).toHaveBeenCalledOnce();
    expect(repo.delete).toHaveBeenCalledWith('release-1');
  });
});

function makeCoverStorage(overrides?: Partial<IFileUploader>): IFileUploader {
  return { upload: vi.fn().mockResolvedValue('https://cdn.example/covers/release-1.jpg'), ...overrides };
}

function makeNotifyQueue(overrides?: Partial<INotifyReleaseQueue>): INotifyReleaseQueue {
  return { add: vi.fn().mockResolvedValue(undefined), ...overrides };
}

const createParams = {
  title: '  New Album  ',
  type: 'ALBUM' as const,
  genre: null,
  releaseDate: null,
  description: '  desc  ',
};

describe('ReleaseService.create', () => {
  it('creates a release with a uuid-generated id, trimming title/description', async () => {
    const repo = makeRepo({ create: vi.fn().mockResolvedValue(mockRelease) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.create('artist-1', createParams);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ releaseId: mockRelease.id });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 'release-1',
      artistProfileId: 'artist-1',
      title: 'New Album',
      description: 'desc',
    }));
  });

  it('collapses a blank description to null', async () => {
    const repo = makeRepo({ create: vi.fn().mockResolvedValue(mockRelease) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    await service.create('artist-1', { ...createParams, description: '   ' });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
  });

  it('uploads the cover under covers/{releaseId}.{ext} when a cover is given', async () => {
    const repo = makeRepo({ create: vi.fn().mockResolvedValue(mockRelease) });
    const coverStorage = makeCoverStorage();
    const service = new ReleaseService(repo, { uuid: () => 'release-1', coverStorage });
    const cover = { buffer: new Uint8Array([1]), ext: 'jpg', mime: 'image/jpeg' };

    await service.create('artist-1', { ...createParams, cover });

    expect(coverStorage.upload).toHaveBeenCalledWith('covers/release-1.jpg', cover.buffer, 'image/jpeg');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ coverUrl: 'https://cdn.example/covers/release-1.jpg' }));
  });

  it('does not touch coverStorage when no cover is given', async () => {
    const repo = makeRepo({ create: vi.fn().mockResolvedValue(mockRelease) });
    const coverStorage = makeCoverStorage();
    const service = new ReleaseService(repo, { uuid: () => 'release-1', coverStorage });

    await service.create('artist-1', createParams);

    expect(coverStorage.upload).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ coverUrl: null }));
  });

  it('throws when a cover is given but coverStorage dependency is missing', async () => {
    const repo = makeRepo({ create: vi.fn().mockResolvedValue(mockRelease) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });
    const cover = { buffer: new Uint8Array([1]), ext: 'jpg', mime: 'image/jpeg' };

    await expect(service.create('artist-1', { ...createParams, cover })).rejects.toThrow('deps.coverStorage');
  });
});

const updateParams = {
  title: '  Updated  ',
  type: 'ALBUM' as const,
  genre: null,
  releaseDate: null,
  description: null,
  linerNotes: '  notes  ',
};

describe('ReleaseService.update', () => {
  it('returns err(NotFoundError) when release does not exist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.update('release-1', 'artist-1', updateParams);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when release belongs to another artist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, artistProfileId: 'other' }) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.update('release-1', 'artist-1', updateParams);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('keeps the previous coverUrl when no new cover is given', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, coverUrl: 'https://old.jpg' }) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    await service.update('release-1', 'artist-1', updateParams);

    expect(repo.update).toHaveBeenCalledWith('release-1', expect.objectContaining({ coverUrl: 'https://old.jpg' }));
  });

  it('uploads a new cover when given and trims title/description/linerNotes', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const coverStorage = makeCoverStorage();
    const service = new ReleaseService(repo, { uuid: () => 'release-1', coverStorage });
    const cover = { buffer: new Uint8Array([1]), ext: 'png', mime: 'image/png' };

    await service.update('release-1', 'artist-1', { ...updateParams, cover });

    expect(coverStorage.upload).toHaveBeenCalledWith('covers/release-1.png', cover.buffer, 'image/png');
    expect(repo.update).toHaveBeenCalledWith('release-1', expect.objectContaining({
      title: 'Updated',
      linerNotes: 'notes',
      coverUrl: 'https://cdn.example/covers/release-1.jpg',
    }));
  });
});

describe('ReleaseService.changeStatus', () => {
  it('returns err(NotFoundError) when release does not exist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.changeStatus('release-1', 'artist-1', 'PUBLISHED', { name: 'A', slug: 'a' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when release belongs to another artist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, artistProfileId: 'other' }) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.changeStatus('release-1', 'artist-1', 'PUBLISHED', { name: 'A', slug: 'a' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('notifies on first publish (DRAFT -> PUBLISHED)', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, status: 'DRAFT' }) });
    const notifyQueue = makeNotifyQueue();
    const service = new ReleaseService(repo, { uuid: () => 'release-1', notifyQueue });

    const result = await service.changeStatus('release-1', 'artist-1', 'PUBLISHED', { name: 'Artist', slug: 'artist' });

    expect(result.ok).toBe(true);
    expect(repo.updateStatus).toHaveBeenCalledWith('release-1', 'PUBLISHED');
    expect(notifyQueue.add).toHaveBeenCalledWith(expect.objectContaining({
      releaseId: 'release-1',
      artistName: 'Artist',
      artistSlug: 'artist',
    }));
  });

  it('does not notify when the release is already PUBLISHED', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, status: 'PUBLISHED' }) });
    const notifyQueue = makeNotifyQueue();
    const service = new ReleaseService(repo, { uuid: () => 'release-1', notifyQueue });

    await service.changeStatus('release-1', 'artist-1', 'PUBLISHED', { name: 'Artist', slug: 'artist' });

    expect(notifyQueue.add).not.toHaveBeenCalled();
  });

  it('does not notify on transitions to a non-PUBLISHED status', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, status: 'DRAFT' }) });
    const notifyQueue = makeNotifyQueue();
    const service = new ReleaseService(repo, { uuid: () => 'release-1', notifyQueue });

    await service.changeStatus('release-1', 'artist-1', 'ARCHIVED', { name: 'Artist', slug: 'artist' });

    expect(notifyQueue.add).not.toHaveBeenCalled();
  });

  it('throws when publishing but notifyQueue dependency is missing, before mutating status', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, status: 'DRAFT' }) });
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    await expect(
      service.changeStatus('release-1', 'artist-1', 'PUBLISHED', { name: 'Artist', slug: 'artist' }),
    ).rejects.toThrow('deps.notifyQueue');
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });
});

describe('ReleaseService.adminUpdate', () => {
  const validInput = {
    title: '  New Title  ',
    type: 'EP',
    genre: 'ROCK',
    releaseDate: '2024-06-01',
    description: '  desc  ',
    linerNotes: '  notes  ',
  };

  it('trims/normalizes and calls repo.update without an ownership check', async () => {
    const repo = makeRepo();
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.adminUpdate('release-1', validInput);

    expect(result.ok).toBe(true);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith('release-1', {
      title: 'New Title',
      type: 'EP',
      genre: 'ROCK',
      releaseDate: new Date('2024-06-01'),
      description: 'desc',
      linerNotes: 'notes',
    });
  });

  it('returns err(ValidationError) when title is empty or exceeds 200 chars', async () => {
    const repo = makeRepo();
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const empty = await service.adminUpdate('release-1', { ...validInput, title: '   ' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error).toBeInstanceOf(ValidationError);
      expect(empty.error.message).toBe('Название: 1–200 символов');
    }

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError) for an invalid type', async () => {
    const repo = makeRepo();
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.adminUpdate('release-1', { ...validInput, type: 'BOGUS' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Неверный тип');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError) for an invalid genre', async () => {
    const repo = makeRepo();
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.adminUpdate('release-1', { ...validInput, genre: 'BOGUS' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Неверный жанр');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('accepts a null genre', async () => {
    const repo = makeRepo();
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.adminUpdate('release-1', { ...validInput, genre: null });

    expect(result.ok).toBe(true);
    expect(repo.update).toHaveBeenCalledWith('release-1', expect.objectContaining({ genre: null }));
  });

  it('returns err(ValidationError) for an unparseable release date', async () => {
    const repo = makeRepo();
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.adminUpdate('release-1', { ...validInput, releaseDate: 'not-a-date' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Неверная дата');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('accepts a null release date', async () => {
    const repo = makeRepo();
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    const result = await service.adminUpdate('release-1', { ...validInput, releaseDate: null });

    expect(result.ok).toBe(true);
    expect(repo.update).toHaveBeenCalledWith('release-1', expect.objectContaining({ releaseDate: null }));
  });

  it('normalizes empty description/linerNotes to null', async () => {
    const repo = makeRepo();
    const service = new ReleaseService(repo, { uuid: () => 'release-1' });

    await service.adminUpdate('release-1', { ...validInput, description: '   ', linerNotes: '   ' });

    expect(repo.update).toHaveBeenCalledWith(
      'release-1',
      expect.objectContaining({ description: null, linerNotes: null }),
    );
  });
});

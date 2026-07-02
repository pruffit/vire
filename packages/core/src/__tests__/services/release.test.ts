import { describe, it, expect, vi } from 'vitest';
import { ReleaseService } from '../../services/release';
import { NotFoundError } from '../../errors';
import type { IReleaseRepository } from '../../repositories/release';
import type { Release, ReleaseWithTracks } from '../../types/release';

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
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ReleaseService.getWithTracks', () => {
  it('returns ok(releaseWithTracks) when release exists', async () => {
    const repo = makeRepo({ findWithTracks: vi.fn().mockResolvedValue(mockReleaseWithTracks) });
    const service = new ReleaseService(repo);

    const result = await service.getWithTracks('release-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.release.id).toBe('release-1');
      expect(result.value.tracks).toHaveLength(1);
    }
  });

  it('returns err(NotFoundError) when release is null', async () => {
    const repo = makeRepo({ findWithTracks: vi.fn().mockResolvedValue(null) });
    const service = new ReleaseService(repo);

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
    const service = new ReleaseService(repo);

    const result = await service.getPublishedByArtist('artist-1');

    expect(result).toBe(releases);
    expect(repo.findPublishedByArtist).toHaveBeenCalledWith('artist-1');
  });

  it('returns empty array when artist has no published releases', async () => {
    const repo = makeRepo({ findPublishedByArtist: vi.fn().mockResolvedValue([]) });
    const service = new ReleaseService(repo);

    const result = await service.getPublishedByArtist('artist-no-releases');

    expect(result).toEqual([]);
  });
});

describe('ReleaseService.deleteRelease', () => {
  it('returns ok when release exists and belongs to artist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const service = new ReleaseService(repo);

    const result = await service.deleteRelease({ releaseId: 'release-1', artistProfileId: 'artist-1' });

    expect(result.ok).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith('release-1');
  });

  it('returns err(NotFoundError) when release does not exist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new ReleaseService(repo);

    const result = await service.deleteRelease({ releaseId: 'missing', artistProfileId: 'artist-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when release belongs to another artist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, artistProfileId: 'other-artist' }) });
    const service = new ReleaseService(repo);

    const result = await service.deleteRelease({ releaseId: 'release-1', artistProfileId: 'artist-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('calls repo.delete with correct id', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const service = new ReleaseService(repo);

    await service.deleteRelease({ releaseId: 'release-1', artistProfileId: 'artist-1' });

    expect(repo.delete).toHaveBeenCalledOnce();
    expect(repo.delete).toHaveBeenCalledWith('release-1');
  });
});

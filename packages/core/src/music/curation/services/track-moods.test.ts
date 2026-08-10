import { describe, it, expect, vi } from 'vitest';
import { TrackMoodsService } from './track-moods';
import { NotFoundError } from '../../../errors';
import type { ITrackRepository } from '../../catalog/repositories/track';
import type { IReleaseRepository } from '../../catalog/repositories/release';
import type { ITrackMoodsRepository } from '../repositories/track-moods';
import type { Release, Track } from '../../catalog/types/release';

const mockRelease: Release = {
  id: 'release-1',
  artistProfileId: 'artist-1',
  title: 'Test Album',
  type: 'ALBUM',
  coverUrl: null,
  releaseDate: null,
  status: 'DRAFT',
  description: null,
  linerNotes: null,
  genre: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockTrack: Track = {
  id: 'track-1',
  releaseId: 'release-1',
  title: 'Track One',
  version: null,
  trackNumber: 1,
  durationSec: null,
  status: 'READY',
  isExclusive: false,
  isWip: false,
  isExplicit: false,
  credits: [],
  lyrics: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function makeTrackRepo(overrides?: Partial<ITrackRepository>): ITrackRepository {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(mockTrack),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
    getSourceKey: vi.fn(),
    getArtistTrackSources: vi.fn(),
    setStatus: vi.fn(),
    ...overrides,
  };
}

function makeReleaseRepo(overrides?: Partial<IReleaseRepository>): IReleaseRepository {
  return {
    findById: vi.fn().mockResolvedValue(mockRelease),
    findWithTracks: vi.fn(),
    findPublishedByArtist: vi.fn(),
    findAllByArtist: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

function makeMoodsRepo(overrides?: Partial<ITrackMoodsRepository>): ITrackMoodsRepository {
  return {
    get: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockResolvedValue(undefined),
    setGenres: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('TrackMoodsService.getMoods', () => {
  it('returns ok(moods) when track exists', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const moodsRepo = makeMoodsRepo({ get: vi.fn().mockResolvedValue(['CHILL', 'NIGHT']) });
    const service = new TrackMoodsService(trackRepo, releaseRepo, moodsRepo);

    const result = await service.getMoods('track-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(['CHILL', 'NIGHT']);
  });

  it('returns err(NotFoundError) when track does not exist', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(null) });
    const releaseRepo = makeReleaseRepo();
    const moodsRepo = makeMoodsRepo();
    const service = new TrackMoodsService(trackRepo, releaseRepo, moodsRepo);

    const result = await service.getMoods('missing');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(moodsRepo.get).not.toHaveBeenCalled();
  });
});

describe('TrackMoodsService.setMoods', () => {
  it('sets moods when track belongs to artist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const moodsRepo = makeMoodsRepo();
    const service = new TrackMoodsService(trackRepo, releaseRepo, moodsRepo);

    const result = await service.setMoods('track-1', 'artist-1', ['CHILL']);

    expect(result.ok).toBe(true);
    expect(moodsRepo.set).toHaveBeenCalledWith('track-1', ['CHILL']);
  });

  it('returns err(NotFoundError) when track does not exist', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(null) });
    const releaseRepo = makeReleaseRepo();
    const moodsRepo = makeMoodsRepo();
    const service = new TrackMoodsService(trackRepo, releaseRepo, moodsRepo);

    const result = await service.setMoods('missing', 'artist-1', ['CHILL']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(moodsRepo.set).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when track belongs to another artist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, artistProfileId: 'other' }) });
    const moodsRepo = makeMoodsRepo();
    const service = new TrackMoodsService(trackRepo, releaseRepo, moodsRepo);

    const result = await service.setMoods('track-1', 'artist-1', ['CHILL']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(moodsRepo.set).not.toHaveBeenCalled();
  });

  it('rejects more than 5 moods without touching repo', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const moodsRepo = makeMoodsRepo();
    const service = new TrackMoodsService(trackRepo, releaseRepo, moodsRepo);

    const result = await service.setMoods('track-1', 'artist-1', ['A', 'B', 'C', 'D', 'E', 'F']);

    expect(result.ok).toBe(false);
    expect(moodsRepo.set).not.toHaveBeenCalled();
  });

  it('accepts exactly 5 moods', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const moodsRepo = makeMoodsRepo();
    const service = new TrackMoodsService(trackRepo, releaseRepo, moodsRepo);

    const result = await service.setMoods('track-1', 'artist-1', ['A', 'B', 'C', 'D', 'E']);

    expect(result.ok).toBe(true);
    expect(moodsRepo.set).toHaveBeenCalledWith('track-1', ['A', 'B', 'C', 'D', 'E']);
  });
});

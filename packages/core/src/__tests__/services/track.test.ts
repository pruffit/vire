import { describe, it, expect, vi } from 'vitest';
import { TrackService } from '../../services/track';
import { NotFoundError } from '../../errors';
import type { ITrackRepository } from '../../repositories/track';
import type { IReleaseRepository } from '../../repositories/release';
import type { ITranscodeQueue } from '../../services/track';
import type { Release, Track } from '../../types/release';

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
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockTrack: Track = {
  id: 'track-1',
  releaseId: 'release-1',
  title: 'Track One',
  trackNumber: 1,
  durationSec: null,
  status: 'PROCESSING',
  isExclusive: false,
  isWip: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function makeTrackRepo(overrides?: Partial<ITrackRepository>): ITrackRepository {
  return { create: vi.fn().mockResolvedValue(mockTrack), ...overrides };
}

function makeReleaseRepo(overrides?: Partial<IReleaseRepository>): IReleaseRepository {
  return {
    findById: vi.fn(),
    findWithTracks: vi.fn(),
    findPublishedByArtist: vi.fn(),
    findAllByArtist: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    ...overrides,
  };
}

function makeQueue(): ITranscodeQueue {
  return { add: vi.fn().mockResolvedValue(undefined) };
}

const uploadParams = {
  trackId: 'track-1',
  releaseId: 'release-1',
  artistProfileId: 'artist-1',
  title: 'Track One',
  trackNumber: 1,
  sourceKey: 'vault/tracks/track-1/source.flac',
};

describe('TrackService.createUpload', () => {
  it('returns ok(track) when release belongs to artist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue);

    const result = await service.createUpload(uploadParams);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(mockTrack);
  });

  it('enqueues transcode job after creating track', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue);

    await service.createUpload(uploadParams);

    expect(queue.add).toHaveBeenCalledOnce();
    expect(queue.add).toHaveBeenCalledWith({
      trackId: 'track-1',
      sourceKey: 'vault/tracks/track-1/source.flac',
    });
  });

  it('returns err(NotFoundError) when release does not exist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(null) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue);

    const result = await service.createUpload(uploadParams);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('returns err(Forbidden) when release belongs to different artist', async () => {
    const differentArtistRelease: Release = { ...mockRelease, artistProfileId: 'other-artist' };
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(differentArtistRelease) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue);

    const result = await service.createUpload(uploadParams);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
  });

  it('does not enqueue job when release is not found', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(null) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue);

    await service.createUpload(uploadParams);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not create track when artist is unauthorized', async () => {
    const differentArtistRelease: Release = { ...mockRelease, artistProfileId: 'other-artist' };
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(differentArtistRelease) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue);

    await service.createUpload(uploadParams);

    expect(trackRepo.create).not.toHaveBeenCalled();
  });
});

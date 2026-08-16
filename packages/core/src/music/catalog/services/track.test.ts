import { describe, it, expect, vi } from 'vitest';
import { TrackService } from './track';
import { NotFoundError, ValidationError } from '../../../errors';
import type { ITrackRepository } from '../repositories/track';
import type { IReleaseRepository } from '../repositories/release';
import type { IFileUploader } from '../../../platform/storage/repositories/storage';
import type { ITrackMoodsRepository } from '../../curation/repositories/track-moods';
import type { ITranscodeQueue, TrackServiceDeps } from './track';
import type { Release, Track } from '../types/release';

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
  status: 'PROCESSING',
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
    create: vi.fn().mockResolvedValue(mockTrack),
    findById: vi.fn().mockResolvedValue(mockTrack),
    update: vi.fn().mockResolvedValue(mockTrack),
    delete: vi.fn().mockResolvedValue(undefined),
    reorder: vi.fn().mockResolvedValue(undefined),
    getSourceKey: vi.fn().mockResolvedValue(null),
    getArtistTrackSources: vi.fn().mockResolvedValue([]),
    setStatus: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
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
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeQueue(): ITranscodeQueue {
  return { add: vi.fn().mockResolvedValue(undefined) };
}

function makeMoodsRepo(overrides?: Partial<ITrackMoodsRepository>): ITrackMoodsRepository {
  return {
    get: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockResolvedValue(undefined),
    setGenres: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeAudioStorage(overrides?: Partial<IFileUploader>): IFileUploader {
  return { upload: vi.fn().mockResolvedValue('s3://vault/tracks/track-1/source.flac'), ...overrides };
}

function makeDeps(overrides?: Partial<TrackServiceDeps>): TrackServiceDeps {
  return { audioStorage: makeAudioStorage(), uuid: () => 'track-1', ...overrides };
}

const uploadParams = {
  releaseId: 'release-1',
  artistProfileId: 'artist-1',
  title: 'Track One',
  trackNumber: 1,
  ext: 'flac' as const,
  buffer: new Uint8Array([1, 2, 3]),
};

describe('TrackService.createUpload', () => {
  it('returns ok(track) when release belongs to artist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());

    const result = await service.createUpload(uploadParams);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(mockTrack);
  });

  it('uploads to audioStorage with the generated key, then creates the track, then enqueues', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const queue = makeQueue();
    const audioStorage = makeAudioStorage();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps({ audioStorage }));

    await service.createUpload(uploadParams);

    expect(audioStorage.upload).toHaveBeenCalledWith('tracks/track-1/source.flac', uploadParams.buffer, 'audio/flac');
    expect(trackRepo.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'track-1' }));
    expect(queue.add).toHaveBeenCalledOnce();
    expect(queue.add).toHaveBeenCalledWith({
      trackId: 'track-1',
      sourceKey: 'tracks/track-1/source.flac',
    });
  });

  it('returns err(NotFoundError) when release does not exist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(null) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());

    const result = await service.createUpload(uploadParams);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('returns err(Forbidden) when release belongs to different artist', async () => {
    const differentArtistRelease: Release = { ...mockRelease, artistProfileId: 'other-artist' };
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(differentArtistRelease) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());

    const result = await service.createUpload(uploadParams);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
  });

  it('does not enqueue job when release is not found', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(null) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());

    await service.createUpload(uploadParams);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not touch audioStorage when release is not found (S3 upload after ownership check)', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(null) });
    const queue = makeQueue();
    const audioStorage = makeAudioStorage();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps({ audioStorage }));

    await service.createUpload(uploadParams);

    expect(audioStorage.upload).not.toHaveBeenCalled();
  });

  it('does not touch audioStorage when artist is unauthorized (S3 upload after ownership check)', async () => {
    const differentArtistRelease: Release = { ...mockRelease, artistProfileId: 'other-artist' };
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(differentArtistRelease) });
    const queue = makeQueue();
    const audioStorage = makeAudioStorage();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps({ audioStorage }));

    await service.createUpload(uploadParams);

    expect(audioStorage.upload).not.toHaveBeenCalled();
  });

  it('throws when audioStorage dependency is missing', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, { uuid: () => 'track-1' });

    await expect(service.createUpload(uploadParams)).rejects.toThrow('deps.audioStorage');
  });

  it('passes credits to trackRepo.create', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());
    const credits = [{ name: 'Danila', role: 'PERFORMER' as const }];

    await service.createUpload({ ...uploadParams, credits });

    expect(trackRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ credits }),
    );
  });

  it('uses empty credits by default', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());

    await service.createUpload(uploadParams);

    expect(trackRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ credits: undefined }),
    );
  });

  it('does not create track when artist is unauthorized', async () => {
    const differentArtistRelease: Release = { ...mockRelease, artistProfileId: 'other-artist' };
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(differentArtistRelease) });
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());

    await service.createUpload(uploadParams);

    expect(trackRepo.create).not.toHaveBeenCalled();
  });
});

describe('TrackService.updateTrack', () => {
  it('updates when track belongs to artist', async () => {
    const trackRepo = makeTrackRepo({ update: vi.fn().mockResolvedValue({ ...mockTrack, title: 'New' }) });
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps());

    const result = await service.updateTrack({ trackId: 'track-1', artistProfileId: 'artist-1', patch: { title: 'New' } });

    expect(result.ok).toBe(true);
    expect(trackRepo.update).toHaveBeenCalledWith('track-1', { title: 'New' });
  });

  it('returns err(NotFoundError) when track missing', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(null) });
    const releaseRepo = makeReleaseRepo();
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps());

    const result = await service.updateTrack({ trackId: 'x', artistProfileId: 'artist-1', patch: { title: 'New' } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(trackRepo.update).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when track belongs to another artist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, artistProfileId: 'other' }) });
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps());

    const result = await service.updateTrack({ trackId: 'track-1', artistProfileId: 'artist-1', patch: { title: 'New' } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(trackRepo.update).not.toHaveBeenCalled();
  });
});

describe('TrackService.deleteTrack', () => {
  it('deletes when track belongs to artist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps());

    const result = await service.deleteTrack({ trackId: 'track-1', artistProfileId: 'artist-1' });

    expect(result.ok).toBe(true);
    expect(trackRepo.delete).toHaveBeenCalledWith('track-1');
  });

  it('регистрирует файлы трека в уборке до удаления строки', async () => {
    const calls: string[] = [];
    const trackRepo = makeTrackRepo({ delete: vi.fn().mockImplementation(async () => { calls.push('delete'); }) });
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(mockRelease) });
    const orphanStorage = {
      enqueue: vi.fn().mockImplementation(async () => { calls.push('enqueue'); }),
      listDue: vi.fn(), markCleaned: vi.fn(), markFailed: vi.fn(),
    };
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps({ orphanStorage }));

    await service.deleteTrack({ trackId: 'track-1', artistProfileId: 'artist-1' });

    expect(calls).toEqual(['enqueue', 'delete']);
    expect(orphanStorage.enqueue).toHaveBeenCalledWith([
      { bucket: 'vault', prefix: 'tracks/track-1/', reason: 'track.deleted', entityId: 'track-1' },
      { bucket: 'stream', prefix: 'tracks/track-1/', reason: 'track.deleted', entityId: 'track-1' },
    ]);
  });

  it('does not delete when track belongs to another artist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue({ ...mockRelease, artistProfileId: 'other' }) });
    const orphanStorage = { enqueue: vi.fn(), listDue: vi.fn(), markCleaned: vi.fn(), markFailed: vi.fn() };
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps({ orphanStorage }));

    const result = await service.deleteTrack({ trackId: 'track-1', artistProfileId: 'artist-1' });

    expect(result.ok).toBe(false);
    expect(trackRepo.delete).not.toHaveBeenCalled();
    expect(orphanStorage.enqueue).not.toHaveBeenCalled();
  });
});

describe('TrackService.reorderTracks', () => {
  const withTracks = {
    release: mockRelease,
    tracks: [
      { ...mockTrack, id: 't1', trackNumber: 1 },
      { ...mockTrack, id: 't2', trackNumber: 2 },
      { ...mockTrack, id: 't3', trackNumber: 3 },
    ],
  };

  it('reorders when ids match release tracks exactly', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({
      findById: vi.fn().mockResolvedValue(mockRelease),
      findWithTracks: vi.fn().mockResolvedValue(withTracks),
    });
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps());

    const result = await service.reorderTracks({
      releaseId: 'release-1',
      artistProfileId: 'artist-1',
      orderedIds: ['t3', 't1', 't2'],
    });

    expect(result.ok).toBe(true);
    expect(trackRepo.reorder).toHaveBeenCalledWith('release-1', ['t3', 't1', 't2']);
  });

  it('returns NotFoundError when release does not exist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps());

    const result = await service.reorderTracks({
      releaseId: 'release-1',
      artistProfileId: 'artist-1',
      orderedIds: ['t1'],
    });

    expect(result.ok).toBe(false);
    expect(trackRepo.reorder).not.toHaveBeenCalled();
  });

  it('forbids reordering tracks of another artist', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({
      findById: vi.fn().mockResolvedValue({ ...mockRelease, artistProfileId: 'other' }),
    });
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps());

    const result = await service.reorderTracks({
      releaseId: 'release-1',
      artistProfileId: 'artist-1',
      orderedIds: ['t1'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(trackRepo.reorder).not.toHaveBeenCalled();
  });

  it('rejects when ids do not match release tracks (missing/extra/dupes)', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo({
      findById: vi.fn().mockResolvedValue(mockRelease),
      findWithTracks: vi.fn().mockResolvedValue(withTracks),
    });
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps());

    const missing = await service.reorderTracks({
      releaseId: 'release-1',
      artistProfileId: 'artist-1',
      orderedIds: ['t1', 't2'],
    });
    expect(missing.ok).toBe(false);

    const dupes = await service.reorderTracks({
      releaseId: 'release-1',
      artistProfileId: 'artist-1',
      orderedIds: ['t1', 't1', 't2'],
    });
    expect(dupes.ok).toBe(false);

    expect(trackRepo.reorder).not.toHaveBeenCalled();
  });
});

describe('TrackService.adminUpdate', () => {
  const validInput = {
    title: '  New Title  ',
    version: '  Radio Edit  ',
    trackNumber: 2,
    isExplicit: true,
    isExclusive: false,
    isWip: false,
    bpm: 120,
    musicalKey: '  8A  ',
    moods: ['CHILL'],
    genres: ['ROCK'],
    credits: [{ name: 'Danila', role: 'PERFORMER' as const }],
    lyrics: null,
  };

  it('updates the track then sets moods then genres, in order, without an ownership check', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const moodsRepo = makeMoodsRepo();
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps({ moodsRepo }));
    const calls: string[] = [];
    (trackRepo.update as ReturnType<typeof vi.fn>).mockImplementation(async () => { calls.push('update'); return mockTrack; });
    (moodsRepo.set as ReturnType<typeof vi.fn>).mockImplementation(async () => { calls.push('set'); });
    (moodsRepo.setGenres as ReturnType<typeof vi.fn>).mockImplementation(async () => { calls.push('setGenres'); });

    const result = await service.adminUpdate('track-1', validInput);

    expect(result.ok).toBe(true);
    expect(trackRepo.findById).not.toHaveBeenCalled();
    expect(trackRepo.update).toHaveBeenCalledWith('track-1', {
      title: 'New Title',
      version: 'Radio Edit',
      trackNumber: 2,
      isExplicit: true,
      isExclusive: false,
      isWip: false,
      bpm: 120,
      musicalKey: '8A',
      credits: validInput.credits,
      lyrics: null,
    });
    expect(moodsRepo.set).toHaveBeenCalledWith('track-1', ['CHILL']);
    expect(moodsRepo.setGenres).toHaveBeenCalledWith('track-1', ['ROCK']);
    expect(calls).toEqual(['update', 'set', 'setGenres']);
  });

  it('returns err(ValidationError) when title is empty or exceeds 200 chars', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps({ moodsRepo: makeMoodsRepo() }));

    const result = await service.adminUpdate('track-1', { ...validInput, title: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe('Название: 1–200 символов');
    }
    expect(trackRepo.update).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError) for a non-positive/non-integer track number', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps({ moodsRepo: makeMoodsRepo() }));

    const result = await service.adminUpdate('track-1', { ...validInput, trackNumber: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Неверный номер');
    expect(trackRepo.update).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError) for bpm outside 20-500', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps({ moodsRepo: makeMoodsRepo() }));

    const result = await service.adminUpdate('track-1', { ...validInput, bpm: 501 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('BPM: 20–500');
    expect(trackRepo.update).not.toHaveBeenCalled();
  });

  it('accepts a null bpm', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const moodsRepo = makeMoodsRepo();
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps({ moodsRepo }));

    const result = await service.adminUpdate('track-1', { ...validInput, bpm: null });

    expect(result.ok).toBe(true);
    expect(trackRepo.update).toHaveBeenCalledWith('track-1', expect.objectContaining({ bpm: null }));
  });

  it('returns err(ValidationError) when lyrics exceed 20000 chars', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps({ moodsRepo: makeMoodsRepo() }));

    const result = await service.adminUpdate('track-1', { ...validInput, lyrics: 'x'.repeat(20001) });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Текст слишком длинный');
    expect(trackRepo.update).not.toHaveBeenCalled();
  });

  it('reports the title error first when both title and lyrics are invalid (validation order)', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps({ moodsRepo: makeMoodsRepo() }));

    const result = await service.adminUpdate('track-1', { ...validInput, title: '   ', lyrics: 'x'.repeat(20001) });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Название: 1–200 символов');
  });

  it('parses lyrics through the injected parseLrc; empty parse result becomes null', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const parsed = [{ t: 1, text: 'line' }];
    const parseLrc = vi.fn().mockReturnValue(parsed);
    const service = new TrackService(
      trackRepo, releaseRepo, makeQueue(), makeDeps({ moodsRepo: makeMoodsRepo(), parseLrc }),
    );

    await service.adminUpdate('track-1', { ...validInput, lyrics: '[00:01.00] line' });
    expect(parseLrc).toHaveBeenCalledWith('[00:01.00] line');
    expect(trackRepo.update).toHaveBeenCalledWith('track-1', expect.objectContaining({ lyrics: parsed }));

    parseLrc.mockReturnValue([]);
    await service.adminUpdate('track-1', { ...validInput, lyrics: 'no timestamps here' });
    expect(trackRepo.update).toHaveBeenLastCalledWith('track-1', expect.objectContaining({ lyrics: null }));
  });

  it('does not call parseLrc for null or blank lyrics', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const parseLrc = vi.fn();
    const service = new TrackService(
      trackRepo, releaseRepo, makeQueue(), makeDeps({ moodsRepo: makeMoodsRepo(), parseLrc }),
    );

    await service.adminUpdate('track-1', { ...validInput, lyrics: '   ' });
    expect(parseLrc).not.toHaveBeenCalled();
    expect(trackRepo.update).toHaveBeenCalledWith('track-1', expect.objectContaining({ lyrics: null }));
  });

  it('throws when moodsRepo dependency is missing', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps());

    await expect(service.adminUpdate('track-1', validInput)).rejects.toThrow('deps.moodsRepo');
  });

  it('throws when parseLrc dependency is missing and lyrics are present', async () => {
    const trackRepo = makeTrackRepo();
    const releaseRepo = makeReleaseRepo();
    const service = new TrackService(trackRepo, releaseRepo, makeQueue(), makeDeps({ moodsRepo: makeMoodsRepo() }));

    await expect(service.adminUpdate('track-1', { ...validInput, lyrics: '[00:01.00] line' }))
      .rejects.toThrow('deps.parseLrc');
  });
});

describe('TrackService.retranscode', () => {
  it('returns err(ValidationError) when there is no source in the vault', async () => {
    const trackRepo = makeTrackRepo({ getSourceKey: vi.fn().mockResolvedValue(null) });
    const releaseRepo = makeReleaseRepo();
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());

    const result = await service.retranscode('track-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe('Нет исходника в vault — пересобрать нечем');
    }
    expect(trackRepo.setStatus).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('sets status to PROCESSING then enqueues the job', async () => {
    const trackRepo = makeTrackRepo({ getSourceKey: vi.fn().mockResolvedValue('tracks/track-1/source.flac') });
    const releaseRepo = makeReleaseRepo();
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());
    const calls: string[] = [];
    (trackRepo.setStatus as ReturnType<typeof vi.fn>).mockImplementation(async () => { calls.push('setStatus'); });
    (queue.add as ReturnType<typeof vi.fn>).mockImplementation(async () => { calls.push('add'); });

    const result = await service.retranscode('track-1');

    expect(result.ok).toBe(true);
    expect(trackRepo.setStatus).toHaveBeenCalledWith('track-1', 'PROCESSING');
    expect(queue.add).toHaveBeenCalledWith({ trackId: 'track-1', sourceKey: 'tracks/track-1/source.flac' });
    expect(calls).toEqual(['setStatus', 'add']);
  });
});

describe('TrackService.retranscodeArtist', () => {
  it('returns err(ValidationError) when the artist has no tracks with a vault source', async () => {
    const trackRepo = makeTrackRepo({ getArtistTrackSources: vi.fn().mockResolvedValue([]) });
    const releaseRepo = makeReleaseRepo();
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());

    const result = await service.retranscodeArtist('artist-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe('Нет треков с исходником в vault');
    }
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('sets status and enqueues every track, returning the queued count', async () => {
    const sources = [
      { trackId: 't1', sourceKey: 'tracks/t1/source.flac' },
      { trackId: 't2', sourceKey: 'tracks/t2/source.flac' },
    ];
    const trackRepo = makeTrackRepo({ getArtistTrackSources: vi.fn().mockResolvedValue(sources) });
    const releaseRepo = makeReleaseRepo();
    const queue = makeQueue();
    const service = new TrackService(trackRepo, releaseRepo, queue, makeDeps());

    const result = await service.retranscodeArtist('artist-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ queued: 2 });
    expect(trackRepo.setStatus).toHaveBeenCalledWith('t1', 'PROCESSING');
    expect(trackRepo.setStatus).toHaveBeenCalledWith('t2', 'PROCESSING');
    expect(queue.add).toHaveBeenCalledWith({ trackId: 't1', sourceKey: 'tracks/t1/source.flac' });
    expect(queue.add).toHaveBeenCalledWith({ trackId: 't2', sourceKey: 'tracks/t2/source.flac' });
  });
});

import { err, ok, NotFoundError, type Result } from '../errors';
import type { ITrackRepository, UpdateTrackParams } from '../repositories/track';
import type { IReleaseRepository } from '../repositories/release';
import type { IFileStorage } from '../repositories/storage';
import type { TranscodeJobData } from '../jobs';
import type { Track, TrackCredit } from '../types/release';
import { authorizeTrackOwnership } from './authorize-track';

export interface ITranscodeQueue {
  add(data: TranscodeJobData): Promise<void>;
}

export type AudioExt = 'wav' | 'flac' | 'mp3';

const AUDIO_CONTENT_TYPE: Record<AudioExt, string> = {
  wav: 'audio/wav',
  flac: 'audio/flac',
  mp3: 'audio/mpeg',
};

export interface TrackServiceDeps {
  audioStorage?: IFileStorage;
  uuid?: () => string;
}

export class TrackService {
  constructor(
    private readonly trackRepo: ITrackRepository,
    private readonly releaseRepo: IReleaseRepository,
    private readonly queue: ITranscodeQueue,
    private readonly deps: TrackServiceDeps = {},
  ) {}

  async createUpload(params: {
    releaseId: string;
    artistProfileId: string;
    title: string;
    trackNumber: number;
    ext: AudioExt;
    buffer: Uint8Array;
    credits?: TrackCredit[];
  }): Promise<Result<Track, NotFoundError | Error>> {
    const release = await this.releaseRepo.findById(params.releaseId);
    if (!release) return err(new NotFoundError('Release', params.releaseId));

    if (release.artistProfileId !== params.artistProfileId) {
      return err(new Error('Forbidden: release does not belong to this artist'));
    }

    // S3-загрузка после проверки владения релизом — при 403/404 осиротевший объект не создаётся.
    if (!this.deps.audioStorage) throw new Error('TrackService: deps.audioStorage is required to upload audio');
    const trackId = this.deps.uuid ? this.deps.uuid() : crypto.randomUUID();
    const sourceKey = `tracks/${trackId}/source.${params.ext}`;
    await this.deps.audioStorage.upload(sourceKey, params.buffer, AUDIO_CONTENT_TYPE[params.ext]);

    const track = await this.trackRepo.create({
      id: trackId,
      releaseId: params.releaseId,
      title: params.title,
      trackNumber: params.trackNumber,
      credits: params.credits,
    });

    await this.queue.add({ trackId, sourceKey });

    return ok(track);
  }

  async updateTrack(params: {
    trackId: string;
    artistProfileId: string;
    patch: UpdateTrackParams;
  }): Promise<Result<Track, NotFoundError | Error>> {
    const authorized = await authorizeTrackOwnership(
      this.trackRepo, this.releaseRepo, params.trackId, params.artistProfileId,
    );
    if (!authorized.ok) return authorized;

    const updated = await this.trackRepo.update(params.trackId, params.patch);
    if (!updated) return err(new NotFoundError('Track', params.trackId));
    return ok(updated);
  }

  async deleteTrack(params: {
    trackId: string;
    artistProfileId: string;
  }): Promise<Result<void, NotFoundError | Error>> {
    const authorized = await authorizeTrackOwnership(
      this.trackRepo, this.releaseRepo, params.trackId, params.artistProfileId,
    );
    if (!authorized.ok) return authorized;

    await this.trackRepo.delete(params.trackId);
    return ok(undefined);
  }

  // orderedIds должен точно совпадать с треками релиза (без лишних/недостающих/дублей) —
  // иначе частичная перенумерация порушила бы нумерацию.
  async reorderTracks(params: {
    releaseId: string;
    artistProfileId: string;
    orderedIds: string[];
  }): Promise<Result<void, NotFoundError | Error>> {
    const release = await this.releaseRepo.findById(params.releaseId);
    if (!release) return err(new NotFoundError('Release', params.releaseId));
    if (release.artistProfileId !== params.artistProfileId) {
      return err(new Error('Forbidden: release does not belong to this artist'));
    }

    const withTracks = await this.releaseRepo.findWithTracks(params.releaseId);
    const actualIds = withTracks ? withTracks.tracks.map((t) => t.id) : [];

    const seen = new Set(params.orderedIds);
    const sameSize = seen.size === params.orderedIds.length && seen.size === actualIds.length;
    const sameMembers = sameSize && actualIds.every((id) => seen.has(id));
    if (!sameMembers) {
      return err(new Error('Order does not match release tracks'));
    }

    await this.trackRepo.reorder(params.releaseId, params.orderedIds);
    return ok(undefined);
  }
}

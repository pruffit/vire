import { err, ok, NotFoundError, type Result } from '../errors';
import type { ITrackRepository, UpdateTrackParams } from '../repositories/track';
import type { IReleaseRepository } from '../repositories/release';
import type { TranscodeJobData } from '../jobs';
import type { Track, TrackCredit } from '../types/release';

export interface ITranscodeQueue {
  add(data: TranscodeJobData): Promise<void>;
}

export class TrackService {
  constructor(
    private readonly trackRepo: ITrackRepository,
    private readonly releaseRepo: IReleaseRepository,
    private readonly queue: ITranscodeQueue,
  ) {}

  async createUpload(params: {
    trackId: string;
    releaseId: string;
    artistProfileId: string;
    title: string;
    trackNumber: number;
    sourceKey: string;
    credits?: TrackCredit[];
  }): Promise<Result<Track, NotFoundError | Error>> {
    const release = await this.releaseRepo.findById(params.releaseId);
    if (!release) return err(new NotFoundError('Release', params.releaseId));

    if (release.artistProfileId !== params.artistProfileId) {
      return err(new Error('Forbidden: release does not belong to this artist'));
    }

    const track = await this.trackRepo.create({
      id: params.trackId,
      releaseId: params.releaseId,
      title: params.title,
      trackNumber: params.trackNumber,
      credits: params.credits,
    });

    await this.queue.add({ trackId: params.trackId, sourceKey: params.sourceKey });

    return ok(track);
  }

  /** Трек существует и принадлежит артисту (через релиз). */
  private async authorizeTrack(
    trackId: string,
    artistProfileId: string,
  ): Promise<Result<Track, NotFoundError | Error>> {
    const track = await this.trackRepo.findById(trackId);
    if (!track) return err(new NotFoundError('Track', trackId));

    const release = await this.releaseRepo.findById(track.releaseId);
    if (!release) return err(new NotFoundError('Release', track.releaseId));
    if (release.artistProfileId !== artistProfileId) {
      return err(new Error('Forbidden: track does not belong to this artist'));
    }
    return ok(track);
  }

  async updateTrack(params: {
    trackId: string;
    artistProfileId: string;
    patch: UpdateTrackParams;
  }): Promise<Result<Track, NotFoundError | Error>> {
    const authorized = await this.authorizeTrack(params.trackId, params.artistProfileId);
    if (!authorized.ok) return authorized;

    const updated = await this.trackRepo.update(params.trackId, params.patch);
    if (!updated) return err(new NotFoundError('Track', params.trackId));
    return ok(updated);
  }

  async deleteTrack(params: {
    trackId: string;
    artistProfileId: string;
  }): Promise<Result<void, NotFoundError | Error>> {
    const authorized = await this.authorizeTrack(params.trackId, params.artistProfileId);
    if (!authorized.ok) return authorized;

    await this.trackRepo.delete(params.trackId);
    return ok(undefined);
  }
}

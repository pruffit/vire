import { err, ok, NotFoundError, type Result } from '../errors';
import type { ITrackRepository } from '../repositories/track';
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
}

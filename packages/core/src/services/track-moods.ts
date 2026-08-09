import { err, ok, NotFoundError, ForbiddenError, ValidationError, type Result } from '../errors';
import type { ITrackRepository } from '../repositories/track';
import type { IReleaseRepository } from '../repositories/release';
import type { ITrackMoodsRepository } from '../repositories/track-moods';
import { authorizeTrackOwnership } from './authorize-track';

const MAX_MOODS = 5;

export class TrackMoodsService {
  constructor(
    private readonly trackRepo: ITrackRepository,
    private readonly releaseRepo: IReleaseRepository,
    private readonly moodsRepo: ITrackMoodsRepository,
  ) {}

  async getMoods(trackId: string): Promise<Result<string[], NotFoundError>> {
    const track = await this.trackRepo.findById(trackId);
    if (!track) return err(new NotFoundError('Track', trackId, 'track.notFound'));
    return ok(await this.moodsRepo.get(trackId));
  }

  async setMoods(
    trackId: string,
    artistProfileId: string,
    moods: readonly string[],
  ): Promise<Result<void, NotFoundError | ForbiddenError | ValidationError>> {
    const authorized = await authorizeTrackOwnership(this.trackRepo, this.releaseRepo, trackId, artistProfileId);
    if (!authorized.ok) return authorized;
    if (moods.length > MAX_MOODS) return err(new ValidationError(`Too many moods: max ${MAX_MOODS}`, 'trackMoods.tooMany'));

    await this.moodsRepo.set(trackId, [...moods]);
    return ok(undefined);
  }
}

import { err, ok, NotFoundError, type Result } from '../errors';
import type { IListenerTrackRepository } from '../repositories/listener-track';
import type { AggregateMoment } from '../types/moment';
import type { LyricLine } from '../types/release';

export class ListenerTrackService {
  constructor(private readonly repo: IListenerTrackRepository) {}

  async getLikeState(userId: string, trackId: string): Promise<Result<boolean, Error>> {
    return ok(await this.repo.getLikeState(userId, trackId));
  }

  async like(userId: string, trackId: string): Promise<Result<void, NotFoundError | Error>> {
    if (!(await this.repo.trackExists(trackId))) return err(new NotFoundError('Track', trackId, 'track.notFound'));
    await this.repo.like(userId, trackId);
    return ok(undefined);
  }

  // Без exists-проверки (1:1 с текущим поведением DELETE /tracks/[id]/like).
  async unlike(userId: string, trackId: string): Promise<Result<void, Error>> {
    await this.repo.unlike(userId, trackId);
    return ok(undefined);
  }

  async getMoments(trackId: string): Promise<Result<AggregateMoment[], NotFoundError | Error>> {
    if (!(await this.repo.trackExists(trackId))) return err(new NotFoundError('Track', trackId, 'track.notFound'));
    return ok(await this.repo.getAggregateMoments(trackId));
  }

  async addMoment(
    trackId: string,
    positionSec: number,
    userId: string | null,
  ): Promise<Result<void, NotFoundError | Error>> {
    if (!(await this.repo.trackExists(trackId))) return err(new NotFoundError('Track', trackId, 'track.notFound'));
    await this.repo.addMoment(trackId, positionSec, userId);
    return ok(undefined);
  }

  async getPublicLyrics(trackId: string): Promise<Result<LyricLine[] | null, Error>> {
    return ok(await this.repo.getPublicLyrics(trackId));
  }
}

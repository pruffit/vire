import type { DB } from '../client';
import type { IListenerTrackRepository, AggregateMoment, LyricLine } from '@vire/core';
import { getLikeState, likeTrack, unlikeTrack } from '../queries/likes';
import { getAggregateMoments, addFavoriteMoment } from '../queries/favorite-moments';
import { getPublicTrackLyrics } from '../queries/lyrics';
import { trackExists as trackExistsQuery } from '../queries/track-audio';

export class DrizzleListenerTrackRepository implements IListenerTrackRepository {
  constructor(private readonly db: DB) {}

  trackExists(trackId: string): Promise<boolean> {
    return trackExistsQuery(trackId);
  }

  getLikeState(userId: string, trackId: string): Promise<boolean> {
    return getLikeState(userId, trackId);
  }

  like(userId: string, trackId: string): Promise<void> {
    return likeTrack(userId, trackId);
  }

  unlike(userId: string, trackId: string): Promise<void> {
    return unlikeTrack(userId, trackId);
  }

  async getAggregateMoments(trackId: string): Promise<AggregateMoment[]> {
    return getAggregateMoments(trackId);
  }

  addMoment(trackId: string, positionSec: number, userId: string | null): Promise<void> {
    return addFavoriteMoment(trackId, positionSec, userId ?? undefined);
  }

  getPublicLyrics(trackId: string): Promise<LyricLine[] | null> {
    return getPublicTrackLyrics(trackId);
  }
}

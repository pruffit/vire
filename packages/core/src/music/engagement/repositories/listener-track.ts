import type { AggregateMoment } from '../types/moment';
import type { LyricLine } from '../../catalog/types/release';

export interface IListenerTrackRepository {
  trackExists(trackId: string): Promise<boolean>;
  getLikeState(userId: string, trackId: string): Promise<boolean>;
  like(userId: string, trackId: string): Promise<void>;
  unlike(userId: string, trackId: string): Promise<void>;
  getAggregateMoments(trackId: string): Promise<AggregateMoment[]>;
  addMoment(trackId: string, positionSec: number, userId: string | null): Promise<void>;
  /** Только для опубликованного релиза (visibility-фильтр — в реализации запроса). */
  getPublicLyrics(trackId: string): Promise<LyricLine[] | null>;
}

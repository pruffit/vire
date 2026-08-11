import type { FeedCandidate } from '../types/feed';
import type { TasteProfile } from '../../playback/types/wave';

export interface IFeedRepository {
  candidates(userId: string, poolSize: number): Promise<FeedCandidate[]>;
  freshCandidates(excludeIds: string[], limit: number): Promise<FeedCandidate[]>;
  taste(userId: string): Promise<TasteProfile | null>;
}

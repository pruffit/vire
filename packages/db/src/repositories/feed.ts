import type { IFeedRepository, FeedCandidate, TasteProfile } from '@vire/core';
import { getFeedCandidates, getFreshFeedCandidates } from '../queries/feed';
import { getTasteProfile } from '../queries/taste';

/** Тонкая обёртка над queries/feed.ts и queries/taste.ts — SQL живёт там, не здесь. */
export class DrizzleFeedRepository implements IFeedRepository {
  candidates(userId: string, poolSize: number): Promise<FeedCandidate[]> {
    return getFeedCandidates(userId, poolSize);
  }

  freshCandidates(excludeIds: string[], limit: number): Promise<FeedCandidate[]> {
    return getFreshFeedCandidates(excludeIds, limit);
  }

  taste(userId: string): Promise<TasteProfile | null> {
    return getTasteProfile(userId);
  }
}

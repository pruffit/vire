import type { Clock } from '../../../platform/ports/effects';
import type { IFeedRepository } from '../repositories/feed';
import type { RankedFeedItem } from '../types/feed';
import { composeFeed, scoreFeedItem } from './feed-ranking';

export const FEED_LIMIT = 24;
export const FEED_COLD_START_THRESHOLD = 6;
export const CANDIDATE_POOL = 120;
export const MAX_PER_ARTIST = 2;
export const SMALL_ARTIST_SHARE = 0.3;

export interface GetFeedInput {
  userId: string;
  limit?: number;
}

export class FeedService {
  constructor(
    private readonly repo: IFeedRepository,
    private readonly clock: Clock,
  ) {}

  /** Состав и порядок секции «Ваша лента» (stage-2 §4.2–4.3): docs/features/feed.md. */
  async getFeed({ userId, limit = FEED_LIMIT }: GetFeedInput): Promise<RankedFeedItem[]> {
    const [candidates, taste] = await Promise.all([
      this.repo.candidates(userId, CANDIDATE_POOL),
      this.repo.taste(userId),
    ]);

    const followedArtistIds = new Set(candidates.filter((c) => c.isFollowed).map((c) => c.artistProfileId));
    const ctx = { now: this.clock(), taste, followedArtistIds };
    const ranked = candidates.map((c) => scoreFeedItem(c, ctx));
    const composed = composeFeed(ranked, { limit, maxPerArtist: MAX_PER_ARTIST, smallArtistShare: SMALL_ARTIST_SHARE });

    if (composed.length >= FEED_COLD_START_THRESHOLD || composed.length >= limit) return composed;

    const excludeIds = composed.map((item) => item.id);
    const fresh = await this.repo.freshCandidates(excludeIds, limit - composed.length).catch(() => []);
    // Причина форсится: сколь угодно похожий на вкус фоллбэк-элемент попал в ленту
    // не за счёт сигнала, а потому что каталог тонкий — подпись должна быть честной.
    const freshRanked = fresh.map((c) => ({ ...scoreFeedItem(c, ctx), reason: 'fresh' as const }));

    return [...composed, ...freshRanked];
  }
}

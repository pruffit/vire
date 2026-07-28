import { getFeedCandidates, getFreshFeedCandidates, getTasteProfile } from '@vire/db';
import { composeFeed, scoreFeedItem, type RankedFeedItem } from '@vire/core';

export const FEED_LIMIT = 24;
export const FEED_COLD_START_THRESHOLD = 6;
const CANDIDATE_POOL = 120;
const MAX_PER_ARTIST = 2;
const SMALL_ARTIST_SHARE = 0.3;

/** Состав и порядок секции «Ваша лента» (stage-2 §4.2–4.3): docs/features/feed.md. */
export async function buildFeed(userId: string, limit = FEED_LIMIT): Promise<RankedFeedItem[]> {
  const [candidates, taste] = await Promise.all([
    getFeedCandidates(userId, CANDIDATE_POOL),
    getTasteProfile(userId),
  ]);

  const followedArtistIds = new Set(candidates.filter((c) => c.isFollowed).map((c) => c.artistProfileId));
  const ctx = { now: Date.now(), taste, followedArtistIds };
  const ranked = candidates.map((c) => scoreFeedItem(c, ctx));
  const composed = composeFeed(ranked, { limit, maxPerArtist: MAX_PER_ARTIST, smallArtistShare: SMALL_ARTIST_SHARE });

  if (composed.length >= FEED_COLD_START_THRESHOLD || composed.length >= limit) return composed;

  const excludeIds = composed.map((item) => item.id);
  const fresh = await getFreshFeedCandidates(excludeIds, limit - composed.length).catch(() => []);
  // Причина форсится: сколь угодно похожий на вкус фоллбэк-элемент попал в ленту
  // не за счёт сигнала, а потому что каталог тонкий — подпись должна быть честной.
  const freshRanked = fresh.map((c) => ({ ...scoreFeedItem(c, ctx), reason: 'fresh' as const }));

  return [...composed, ...freshRanked];
}

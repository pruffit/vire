import { DrizzleFeedRepository } from '@vire/db';
import { FeedService, FEED_LIMIT, FEED_COLD_START_THRESHOLD, type RankedFeedItem } from '@vire/core';

export { FEED_LIMIT, FEED_COLD_START_THRESHOLD };

function feedService(): FeedService {
  return new FeedService(new DrizzleFeedRepository(), Date.now);
}

export function buildFeed(userId: string, limit = FEED_LIMIT): Promise<RankedFeedItem[]> {
  return feedService().getFeed({ userId, limit });
}

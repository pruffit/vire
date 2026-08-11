import { z } from 'zod';

export const feedItemSchema = z.object({
  kind: z.enum(['RELEASE', 'POST', 'UPCOMING']),
  id: z.string(),
  artistProfileId: z.string(),
  artistSlug: z.string(),
  artistName: z.string(),
  artistAvatarUrl: z.string().nullable(),
  occurredAt: z.string(),
  isFollowed: z.boolean(),
  genres: z.array(z.string()),
  moods: z.array(z.string()),
  plays30d: z.number(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  hasExplicit: z.boolean(),
  releaseType: z.string().nullable(),
  body: z.string().nullable(),
  reason: z.enum(['follow', 'taste', 'fresh']),
  score: z.number(),
});
export type FeedItemDTO = z.infer<typeof feedItemSchema>;

export const feedResponseSchema = z.object({
  items: z.array(feedItemSchema),
});
export type FeedResponse = z.infer<typeof feedResponseSchema>;

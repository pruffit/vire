import { z } from 'zod';

export const searchArtistSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  firstReleaseCoverUrl: z.string().nullable(),
  verified: z.boolean(),
});

export const searchReleaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  genre: z.string().nullable(),
  coverUrl: z.string().nullable(),
  artistSlug: z.string(),
  artistName: z.string(),
});

export const searchTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  releaseId: z.string(),
  artistSlug: z.string(),
  artistName: z.string(),
  coverUrl: z.string().nullable(),
  version: z.string().nullable(),
  feat: z.array(z.string()),
});

export const searchResponseSchema = z.object({
  artists: z.array(searchArtistSchema),
  releases: z.array(searchReleaseSchema),
  tracks: z.array(searchTrackSchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

/** Присутствие на сайте: сколько человек онлайн сейчас. Сбой Redis отдаёт 0, а не ошибку. */
export const presenceResponseSchema = z.object({ online: z.number().int().nonnegative() });
export type PresenceResponse = z.infer<typeof presenceResponseSchema>;

export const sessionResponseSchema = z.object({ sessionId: z.string().min(1) });
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const listeningNowTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  artistSlug: z.string(),
  releaseId: z.string(),
  coverUrl: z.string().nullable(),
  accentColor: z.string().nullable(),
  version: z.string().nullable(),
  feat: z.array(z.string()),
  listeners: z.number().int().nonnegative(),
});
export const listeningNowResponseSchema = z.object({ tracks: z.array(listeningNowTrackSchema) });
export type ListeningNowResponse = z.infer<typeof listeningNowResponseSchema>;

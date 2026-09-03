import { z } from 'zod';

const contextArtistSchema = z.object({
  slug: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  /** Акцент темы артиста: плеер красит им фон и главную кнопку. */
  accentColor: z.string().nullable(),
  followerCount: z.number().int().nonnegative(),
});

const contextSimilarArtistSchema = z.object({
  slug: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});

export const trackContextResponseSchema = z.object({
  artist: contextArtistSchema,
  similar: z.array(contextSimilarArtistSchema),
});
export type TrackContextResponse = z.infer<typeof trackContextResponseSchema>;

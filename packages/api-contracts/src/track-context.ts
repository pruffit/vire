import { z } from 'zod';

const contextArtistSchema = z.object({
  slug: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
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

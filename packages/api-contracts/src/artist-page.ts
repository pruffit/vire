import { z } from 'zod';
import { artistProfileSchema, artistLinkSchema, releaseSchema, releaseCardSchema } from './catalog';

const artistPostSchema = z.object({
  id: z.string(),
  artistProfileId: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const smartLinkSchema = z.object({
  id: z.string(),
  artistProfileId: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  coverUrl: z.string().nullable(),
  releaseDate: z.string().nullable(),
  releaseId: z.string().nullable(),
  links: z.array(artistLinkSchema),
  isPublished: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const artistPlayableTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  releaseId: z.string(),
  coverUrl: z.string().nullable(),
  durationSec: z.number().nullable(),
  isExplicit: z.boolean(),
  plays: z.number(),
  version: z.string().nullable(),
  feat: z.array(z.string()),
});

export const artistPageResponseSchema = z.object({
  artist: artistProfileSchema,
  releases: z.array(releaseSchema),
  upcoming: z.array(releaseCardSchema),
  posts: z.array(artistPostSchema),
  smartLinks: z.array(smartLinkSchema),
  playableTracks: z.array(artistPlayableTrackSchema),
  explicitReleaseIds: z.array(z.string()),
  following: z.boolean(),
  followerCount: z.number(),
  presavedReleaseIds: z.array(z.string()),
});
export type ArtistPageResponse = z.infer<typeof artistPageResponseSchema>;

import { z } from 'zod';

const themeTokensSchema = z.object({
  bg: z.string(),
  text: z.string(),
  accent: z.string(),
  grain: z.boolean(),
  fontSans: z.string(),
  fontMono: z.string(),
});

const artistLinkSchema = z.object({
  url: z.string(),
  label: z.string().optional(),
});

const artistVideoSchema = z.object({
  url: z.string(),
  title: z.string(),
});

const artistProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  slug: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  headerUrl: z.string().nullable(),
  themeTokens: themeTokensSchema,
  links: z.array(artistLinkSchema),
  videos: z.array(artistVideoSchema),
  verified: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const releaseSchema = z.object({
  id: z.string(),
  artistProfileId: z.string(),
  title: z.string(),
  type: z.enum(['ALBUM', 'EP', 'SINGLE']),
  genre: z.string().nullable(),
  coverUrl: z.string().nullable(),
  releaseDate: z.string().nullable(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']),
  description: z.string().nullable(),
  linerNotes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const artistUpcomingReleaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  coverUrl: z.string().nullable(),
  releaseDate: z.string().nullable(),
  artistName: z.string(),
  artistSlug: z.string(),
  artistAvatarUrl: z.string().nullable(),
  hasExplicit: z.boolean(),
  accentColor: z.string().nullable(),
});

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
  upcoming: z.array(artistUpcomingReleaseSchema),
  posts: z.array(artistPostSchema),
  smartLinks: z.array(smartLinkSchema),
  playableTracks: z.array(artistPlayableTrackSchema),
  explicitReleaseIds: z.array(z.string()),
  following: z.boolean(),
  followerCount: z.number(),
  presavedReleaseIds: z.array(z.string()),
});
export type ArtistPageResponse = z.infer<typeof artistPageResponseSchema>;

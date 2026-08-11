import { z } from 'zod';

export const themeTokensSchema = z.object({
  bg: z.string(),
  text: z.string(),
  accent: z.string(),
  grain: z.boolean(),
  fontSans: z.string(),
  fontMono: z.string(),
});

export const artistLinkSchema = z.object({
  url: z.string(),
  label: z.string().optional(),
});

export const artistVideoSchema = z.object({
  url: z.string(),
  title: z.string(),
});

export const artistProfileSchema = z.object({
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

export const releaseSchema = z.object({
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

export const releaseCardSchema = z.object({
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
export type ReleaseCardDTO = z.infer<typeof releaseCardSchema>;

export const artistCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  firstReleaseCoverUrl: z.string().nullable(),
  verified: z.boolean(),
  releaseCount: z.number(),
  genres: z.array(z.string()),
});
export type ArtistCardDTO = z.infer<typeof artistCardSchema>;

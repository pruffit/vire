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

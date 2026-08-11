import { z } from 'zod';
import { artistProfileSchema, releaseSchema } from './catalog';

export const trackSchema = z.object({
  id: z.string(),
  releaseId: z.string(),
  title: z.string(),
  version: z.string().nullable(),
  trackNumber: z.number(),
  durationSec: z.number().nullable(),
  status: z.enum(['PROCESSING', 'READY', 'BLOCKED', 'FAILED']),
  isExclusive: z.boolean(),
  isWip: z.boolean(),
  isExplicit: z.boolean(),
  credits: z.array(z.object({
    name: z.string(),
    role: z.enum(['PERFORMER', 'FEATURED', 'LYRICIST', 'COMPOSER', 'PRODUCER']),
  })),
  lyrics: z.array(z.object({ t: z.number().nullable(), text: z.string() })).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const releasePageResponseSchema = z.object({
  artist: artistProfileSchema,
  release: releaseSchema,
  tracks: z.array(trackSchema),
  isReleased: z.boolean(),
  showCountdown: z.boolean(),
  presaved: z.boolean(),
});
export type ReleasePageResponse = z.infer<typeof releasePageResponseSchema>;

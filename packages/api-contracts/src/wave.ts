import { z } from 'zod';

export const PLAY_SOURCES = ['wave','release','playlist','artist','home','feed','search','liked','purchased','direct'] as const;
export const playSourceSchema = z.enum(PLAY_SOURCES);
export type PlaySource = z.infer<typeof playSourceSchema>;

export const waveTrackSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  artistName: z.string(),
  artistSlug: z.string(),
  releaseId: z.string().uuid(),
  coverUrl: z.string().nullable(),
  accentColor: z.string().nullable(),
  isExplicit: z.boolean(),
  version: z.string().nullable().default(null),
  feat: z.array(z.string()).default([]),
});
export type WaveTrackDTO = z.infer<typeof waveTrackSchema>;

export const waveQuerySchema = z.object({
  sessionId: z.string().min(8).max(64).optional(),
  trackId: z.string().uuid().optional(),
  mood: z.string().optional(),      // валидируется по ALL_MOODS на роуте
  genre: z.string().optional(),     // валидируется по ALL_TRACK_GENRES на роуте
  played: z.string().optional(),    // csv uuid, ≤100 после парсинга
  count: z.coerce.number().int().min(1).max(5).default(3),
});

export const waveResponseSchema = z.object({ tracks: z.array(waveTrackSchema) });
export type WaveResponse = z.infer<typeof waveResponseSchema>;

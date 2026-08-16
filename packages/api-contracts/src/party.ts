import { z } from 'zod';

/** Источники, из которых трек реально проигрывается (embed-плеер или локальный файл). */
export const playableExternalSourceSchema = z.enum(['YOUTUBE', 'SOUNDCLOUD', 'AUDIUS', 'LOCAL']);

export const externalTrackRefSchema = z.object({
  source: playableExternalSourceSchema,
  externalId: z.string(),
  /** LOCAL — файл лежит только в памяти браузера-колонки, ссылки нет. */
  externalUrl: z.string().nullable(),
  title: z.string(),
  artistName: z.string(),
  coverUrl: z.string().nullable(),
  durationSec: z.number().nullable(),
});

export const metadataHintSchema = z.object({
  title: z.string(),
  artistName: z.string(),
  coverUrl: z.string().nullable(),
  durationSec: z.number().nullable(),
});

// Размеченное объединение: клиент решает по kind, что показать и что можно проиграть сразу.
export const trackCandidateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('VIRE'),
    trackId: z.string(),
    title: z.string(),
    artistName: z.string(),
    coverUrl: z.string().nullable(),
  }),
  z.object({ kind: z.literal('EXTERNAL'), ref: externalTrackRefSchema }),
  z.object({ kind: z.literal('HINT'), hint: metadataHintSchema }),
]);
export type TrackCandidateDTO = z.infer<typeof trackCandidateSchema>;

export const partySuggestResponseSchema = z.object({ candidates: z.array(trackCandidateSchema) });
export type PartySuggestResponse = z.infer<typeof partySuggestResponseSchema>;

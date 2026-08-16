import { z } from 'zod';

/** Пики волны — предрассчитанный массив; формат задаёт воркер, клиент только рисует. */
export const waveformPeaksSchema = z.array(z.number()).nullable();

export const trackManifestResponseSchema = z.object({
  hlsUrl: z.string(),
  waveformPeaks: waveformPeaksSchema,
});
export type TrackManifestResponse = z.infer<typeof trackManifestResponseSchema>;

export const lyricLineSchema = z.object({
  /** Таймкод в секундах; null — строка без синхронизации. */
  t: z.number().nullable(),
  text: z.string(),
});
export const trackLyricsResponseSchema = z.object({
  lyrics: z.array(lyricLineSchema).nullable(),
});
export type TrackLyricsResponse = z.infer<typeof trackLyricsResponseSchema>;

export const aggregateMomentSchema = z.object({
  positionSec: z.number(),
  count: z.number().int().nonnegative(),
});
export const trackMomentsResponseSchema = z.object({ moments: z.array(aggregateMomentSchema) });
export type TrackMomentsResponse = z.infer<typeof trackMomentsResponseSchema>;

export const addMomentRequestSchema = z.object({ positionSec: z.number().nonnegative() });
export type AddMomentRequest = z.infer<typeof addMomentRequestSchema>;

export const trackMoodsResponseSchema = z.object({ moods: z.array(z.string()) });
export type TrackMoodsResponse = z.infer<typeof trackMoodsResponseSchema>;

export const listeningCountResponseSchema = z.object({ count: z.number().int().nonnegative() });
export type ListeningCountResponse = z.infer<typeof listeningCountResponseSchema>;

// Покупка: либо уже куплено, либо ссылка на подтверждение платежа у провайдера.
export const purchaseResponseSchema = z.union([
  z.object({ ok: z.literal(true), alreadyOwned: z.literal(true) }),
  z.object({ confirmationUrl: z.string() }),
]);
export type PurchaseResponse = z.infer<typeof purchaseResponseSchema>;

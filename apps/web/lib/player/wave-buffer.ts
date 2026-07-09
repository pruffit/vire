import { waveResponseSchema } from '@vire/api-contracts';
import type { PlayerTrack } from '@/store/player';

const WAVE_BUFFER_LOW_WATERMARK = 2;

/** Пора ли дозапросить буфер волны: остаток очереди после текущего трека мал,
 *  режим волны включён и запрос ещё не летит. */
export function needsWaveFetch(
  queueLen: number,
  queueIndex: number,
  waveMode: boolean,
  inFlight: boolean,
): boolean {
  if (!waveMode || inFlight) return false;
  const remaining = queueLen - 1 - queueIndex;
  return remaining <= WAVE_BUFFER_LOW_WATERMARK;
}

export interface FetchWaveTracksParams {
  sessionId: string;
  trackId?: string;
  mood?: string;
  genre?: string;
  played: string[];
  count?: number;
}

/** Дозапрос треков волны — парсится через waveResponseSchema, невалидный ответ даёт []. */
export async function fetchWaveTracks(params: FetchWaveTracksParams): Promise<PlayerTrack[]> {
  const query = new URLSearchParams({ sessionId: params.sessionId, count: String(params.count ?? 3) });
  if (params.trackId) query.set('trackId', params.trackId);
  if (params.mood) query.set('mood', params.mood);
  if (params.genre) query.set('genre', params.genre);
  if (params.played.length > 0) query.set('played', params.played.slice(-100).join(','));

  const res = await fetch(`/api/v1/wave?${query.toString()}`).catch(() => null);
  if (!res?.ok) return [];

  const json = await res.json().catch(() => null);
  const parsed = waveResponseSchema.safeParse(json);
  if (!parsed.success) return [];

  return parsed.data.tracks.map((t) => ({
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    artistSlug: t.artistSlug,
    releaseId: t.releaseId,
    coverUrl: t.coverUrl,
    accentColor: t.accentColor ?? undefined,
    isExplicit: t.isExplicit,
    version: t.version,
    feat: t.feat,
  }));
}

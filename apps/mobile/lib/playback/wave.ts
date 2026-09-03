import { waveResponseSchema } from '@vire/api-contracts';
import { apiRequest } from '../api-client';
import type { QueueTrack } from '../player-store';

/** Сколько треков просить за раз. Потолок роута — 5; волна рассчитана подливать по ходу. */
export const WAVE_BATCH = 5;
/** Роут режет список сам, но незачем гнать по сети всю историю сеанса. */
const PLAYED_LIMIT = 100;

/**
 * Волна, засеянная треком: «ещё вот такого же».
 *
 * Длительности в ответе нет — она приезжает с манифестом при загрузке трека, и до тех пор
 * в очереди её просто нет (мини-плеер и списки это переживают).
 */
export async function fetchWaveTracks(seedTrackId: string, playedIds: string[]): Promise<QueueTrack[]> {
  const params = new URLSearchParams({ trackId: seedTrackId, count: String(WAVE_BATCH) });
  const played = playedIds.slice(-PLAYED_LIMIT).join(',');
  if (played) params.set('played', played);

  const r = await apiRequest(`/api/v1/wave?${params.toString()}`, { schema: waveResponseSchema });
  if (!r.ok) return [];

  return r.data.tracks.map((t) => ({
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    coverUrl: t.coverUrl,
    durationSec: null,
  }));
}

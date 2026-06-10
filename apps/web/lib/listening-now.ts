import { getTracksByIds, type DiscoveryTrack } from '@vire/db';
import { listListening } from './presence';

export interface ListeningNowItem extends DiscoveryTrack {
  listeners: number;
}

/**
 * Треки, которые слушают прямо сейчас: live-счётчики из Redis + публичные
 * данные треков из БД. Деградирует до пустого списка при сбое Redis.
 */
export async function getListeningNow(limit = 6): Promise<ListeningNowItem[]> {
  const live = await listListening(limit * 2).catch(() => []);
  if (live.length === 0) return [];

  const counts = new Map(live.map((l) => [l.trackId, l.count]));
  const tracks = await getTracksByIds(live.map((l) => l.trackId));

  return tracks
    .map((t) => ({ ...t, listeners: counts.get(t.id) ?? 0 }))
    .filter((t) => t.listeners > 0)
    .sort((a, b) => b.listeners - a.listeners)
    .slice(0, limit);
}

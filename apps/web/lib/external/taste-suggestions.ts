import { getUserLastfmUsername, getLikedTracks } from '@vire/db';
import { normalizeQueryKey, type TrackCandidate } from '@vire/core';
import { createLastfmTaste } from './lastfm';

const FETCH_LIMIT = 20;

/** Подсказки по вкусу из привязанного Last.fm, минус уже лайкнутое. Ника нет/ключа нет/API молчит → []. */
export async function tasteSuggestions(userId: string, limit: number): Promise<TrackCandidate[]> {
  const username = await getUserLastfmUsername(userId);
  if (!username) return [];

  const lastfm = createLastfmTaste(process.env.LASTFM_API_KEY);
  const [hints, liked] = await Promise.all([lastfm.topTracks(username, FETCH_LIMIT), getLikedTracks(userId)]);
  if (hints.length === 0) return [];

  const likedKeys = new Set(liked.map((t) => normalizeQueryKey(t.artistName, t.title)));
  return hints
    .filter((h) => !likedKeys.has(normalizeQueryKey(h.artistName, h.title)))
    .slice(0, limit)
    .map((hint): TrackCandidate => ({ kind: 'HINT', hint }));
}

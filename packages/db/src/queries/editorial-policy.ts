import type { Mood } from './track-moods';

export const MIN_PERSONAL_PLAYLIST_TRACKS = 5;

export const PLAYLIST_LIST_LIMIT = 25;

export function fillToLimit(
  ids: string[],
  pool: string[],
  avoid: ReadonlySet<string> = new Set(),
  limit: number = PLAYLIST_LIST_LIMIT,
): string[] {
  const out = ids.slice(0, limit);
  const have = new Set(out);
  for (const id of pool) {
    if (out.length >= limit) break;
    if (!have.has(id) && !avoid.has(id)) {
      out.push(id);
      have.add(id);
    }
  }
  for (const id of pool) {
    if (out.length >= limit) break;
    if (!have.has(id)) {
      out.push(id);
      have.add(id);
    }
  }
  return out;
}

export function hasEnoughTracksForPersonalPlaylist(trackCount: number): boolean {
  return trackCount >= MIN_PERSONAL_PLAYLIST_TRACKS;
}

export function pickPersonalMoods(
  tasteMoods: Mood[],
  excludedMoods: Mood[],
  count: number,
): Mood[] {
  if (count <= 0) return [];
  const excluded = new Set(excludedMoods);
  const picked: Mood[] = [];
  for (const mood of tasteMoods) {
    if (excluded.has(mood)) continue;
    picked.push(mood);
    if (picked.length >= count) break;
  }
  return picked;
}

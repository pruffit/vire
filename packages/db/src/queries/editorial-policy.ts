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

export interface PlaylistCandidate {
  trackId: string;
  artistId: string;
}

export const MAX_PER_ARTIST = 3;

export function composePlaylist(
  genuine: PlaylistCandidate[],
  pool: PlaylistCandidate[],
  avoid: ReadonlySet<string> = new Set(),
  limit: number = PLAYLIST_LIST_LIMIT,
  maxPerArtist: number = MAX_PER_ARTIST,
): string[] {
  const out: string[] = [];
  const have = new Set<string>();
  const perArtist = new Map<string, number>();

  const push = (cand: PlaylistCandidate) => {
    out.push(cand.trackId);
    have.add(cand.trackId);
    perArtist.set(cand.artistId, (perArtist.get(cand.artistId) ?? 0) + 1);
  };

  // cap переупорядочивает genuine, но не выбрасывает: подлинное совпадение важнее филлера
  const deferred: PlaylistCandidate[] = [];
  for (const cand of genuine) {
    if (out.length >= limit) break;
    if (have.has(cand.trackId)) continue;
    if ((perArtist.get(cand.artistId) ?? 0) >= maxPerArtist) {
      deferred.push(cand);
      continue;
    }
    push(cand);
  }
  for (const cand of deferred) {
    if (out.length >= limit) break;
    if (!have.has(cand.trackId)) push(cand);
  }

  const passes: Array<(cand: PlaylistCandidate) => boolean> = [
    (cand) => !avoid.has(cand.trackId) && (perArtist.get(cand.artistId) ?? 0) < maxPerArtist,
    (cand) => !avoid.has(cand.trackId),
    () => true,
  ];
  for (const pass of passes) {
    for (const cand of pool) {
      if (out.length >= limit) break;
      if (have.has(cand.trackId) || !pass(cand)) continue;
      push(cand);
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

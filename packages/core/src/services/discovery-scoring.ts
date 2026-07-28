import type { DiscoveryCandidate, DiscoveryReason, RankedDiscoveryArtist, TasteSignature } from '../types/discovery';

export const W_CO_LISTEN = 0.45;
export const W_TASTE_OVERLAP = 0.35;
export const W_FRIEND_SIGNAL = 0.20;

// трёх друзей достаточно для максимума сигнала — дальше один популярный
// у компании артист не должен забивать всю выдачу
export const FRIEND_SIGNAL_SATURATION = 3;

export const DEFAULT_DISCOVERY_LIMIT = 12;
export const DEFAULT_MAX_PER_SOURCE = 1;

export function friendSignal(friendListeners: number): number {
  return Math.min(1, Math.max(0, friendListeners) / FRIEND_SIGNAL_SATURATION);
}

// доля пересечения по тегам жанр+настроение вместе (Jaccard) — не два отдельных
// терма, тег есть тег вне зависимости от того, жанр он или настроение
export function tasteOverlapScore(a: TasteSignature, b: TasteSignature): number {
  const tagsA = new Set([...a.genres, ...a.moods]);
  const tagsB = new Set([...b.genres, ...b.moods]);
  if (tagsA.size === 0 || tagsB.size === 0) return 0;

  let intersection = 0;
  for (const tag of tagsA) if (tagsB.has(tag)) intersection += 1;
  const union = tagsA.size + tagsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function scoreDiscoveryArtist(candidate: DiscoveryCandidate): number {
  return candidate.coListen * W_CO_LISTEN
    + candidate.tasteOverlap * W_TASTE_OVERLAP
    + friendSignal(candidate.friendListeners) * W_FRIEND_SIGNAL;
}

// старший сработавший сигнал: друзья заметнее «похоже на», «похоже на» заметнее
// голого совпадения по вкусу
export function discoveryReason(candidate: DiscoveryCandidate): DiscoveryReason {
  if (candidate.friendListeners > 0) return 'friends';
  if (candidate.coListen > 0) return 'similar';
  return 'taste';
}

export interface ComposeDiscoveryOptions {
  limit?: number;
  maxPerSource?: number;
}

export function composeDiscovery(
  candidates: readonly DiscoveryCandidate[],
  opts: ComposeDiscoveryOptions = {},
): RankedDiscoveryArtist[] {
  const limit = opts.limit ?? DEFAULT_DISCOVERY_LIMIT;
  const maxPerSource = opts.maxPerSource ?? DEFAULT_MAX_PER_SOURCE;
  if (limit <= 0) return [];

  const byArtist = new Map<string, RankedDiscoveryArtist>();
  for (const candidate of candidates) {
    const ranked: RankedDiscoveryArtist = {
      ...candidate,
      score: scoreDiscoveryArtist(candidate),
      reason: discoveryReason(candidate),
    };
    const existing = byArtist.get(candidate.artistProfileId);
    if (!existing || ranked.score > existing.score) byArtist.set(candidate.artistProfileId, ranked);
  }
  const sorted = [...byArtist.values()].sort((a, b) => b.score - a.score);

  const perSourceCount = new Map<string, number>();
  const selected: RankedDiscoveryArtist[] = [];
  for (const item of sorted) {
    if (selected.length >= limit) break;
    const used = perSourceCount.get(item.sourceArtistId) ?? 0;
    if (used >= maxPerSource) continue;
    selected.push(item);
    perSourceCount.set(item.sourceArtistId, used + 1);
  }
  return selected;
}

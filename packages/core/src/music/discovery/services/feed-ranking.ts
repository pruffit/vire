import type { FeedCandidate, FeedItemKind, FeedReason, FeedScoringContext, RankedFeedItem } from '../types/feed';
import { saturateLog } from '../../../platform/util/scoring';

export const W_RECENCY = 0.45;
export const W_AFFINITY = 0.4;
export const W_POPULARITY = 0.15;

export const RELEASE_HALF_LIFE_DAYS = 7;
export const ANNOUNCEMENT_HALF_LIFE_DAYS = 3;
// Дизайн не даёт отдельного значения — "скорый релиз считается от даты выхода
// вперёд", тот же по природе сигнал, что и вышедший релиз.
export const UPCOMING_HALF_LIFE_DAYS = RELEASE_HALF_LIFE_DAYS;

export const POST_KIND_BONUS = 0.05;
export const UPCOMING_KIND_BONUS = 0.1;

// Не задано дизайном численно; насыщение в духе Wilson/BM25 — при K=100 сотня
// прослушиваний даёт ~0.6 от максимума, тысяча — ~0.85, не более.
export const POPULARITY_SATURATION_K = 100;

export const DEFAULT_COMPOSE_LIMIT = 24;
export const DEFAULT_MAX_PER_ARTIST = 2;
export const DEFAULT_SMALL_ARTIST_SHARE = 0.3;

const MS_PER_DAY = 86_400_000;

export function recencyScore(ageDays: number, halfLifeDays: number): number {
  return Math.exp(-Math.max(0, ageDays) / halfLifeDays);
}

export function popularityScore(plays30d: number, k: number = POPULARITY_SATURATION_K): number {
  return saturateLog(plays30d, k);
}

function halfLifeDaysFor(kind: FeedItemKind): number {
  switch (kind) {
    case 'RELEASE': return RELEASE_HALF_LIFE_DAYS;
    case 'POST': return ANNOUNCEMENT_HALF_LIFE_DAYS;
    case 'UPCOMING': return UPCOMING_HALF_LIFE_DAYS;
  }
}

function kindBonusFor(kind: FeedItemKind): number {
  switch (kind) {
    case 'RELEASE': return 0;
    case 'POST': return POST_KIND_BONUS;
    case 'UPCOMING': return UPCOMING_KIND_BONUS;
  }
}

// Скорый релиз считается от даты выхода вперёд (чем ближе — тем выше), поэтому
// возраст — расстояние до occurredAt, а не от него.
function ageDaysFor(candidate: FeedCandidate, now: number): number {
  const diffMs = candidate.kind === 'UPCOMING'
    ? candidate.occurredAt.getTime() - now
    : now - candidate.occurredAt.getTime();
  return Math.max(0, diffMs / MS_PER_DAY);
}

// affinity — максимум сигнала, не сумма; ветки те же, что определяют FeedReason,
// поэтому обе функции читают один и тот же порядок приоритета.
function matchesTasteArtist(candidate: FeedCandidate, taste: FeedScoringContext['taste']): boolean {
  return Boolean(taste?.topArtistIds.includes(candidate.artistProfileId));
}

function matchesTasteGenreOrMood(candidate: FeedCandidate, taste: FeedScoringContext['taste']): boolean {
  if (!taste) return false;
  return candidate.genres.some((g) => taste.topGenres.includes(g))
    || candidate.moods.some((m) => taste.topMoods.includes(m));
}

export function affinityScore(
  candidate: FeedCandidate,
  taste: FeedScoringContext['taste'],
  followedArtistIds: ReadonlySet<string>,
): number {
  if (candidate.isFollowed || followedArtistIds.has(candidate.artistProfileId)) return 1.0;
  if (matchesTasteArtist(candidate, taste)) return 0.7;
  if (matchesTasteGenreOrMood(candidate, taste)) return 0.5;
  return 0.25;
}

export function feedReason(
  candidate: FeedCandidate,
  taste: FeedScoringContext['taste'],
  followedArtistIds: ReadonlySet<string>,
): FeedReason {
  if (candidate.isFollowed || followedArtistIds.has(candidate.artistProfileId)) return 'follow';
  if (matchesTasteArtist(candidate, taste) || matchesTasteGenreOrMood(candidate, taste)) return 'taste';
  return 'fresh';
}

export function scoreFeedItem(candidate: FeedCandidate, ctx: FeedScoringContext): RankedFeedItem {
  const recency = recencyScore(ageDaysFor(candidate, ctx.now), halfLifeDaysFor(candidate.kind));
  const affinity = affinityScore(candidate, ctx.taste, ctx.followedArtistIds);
  const popularity = popularityScore(candidate.plays30d);
  const score = recency * W_RECENCY + affinity * W_AFFINITY + popularity * W_POPULARITY + kindBonusFor(candidate.kind);

  return {
    ...candidate,
    score,
    reason: feedReason(candidate, ctx.taste, ctx.followedArtistIds),
  };
}

function feedKey(item: RankedFeedItem): string {
  return `${item.kind}:${item.id}`;
}

function dedupeKeepingBestScore(items: readonly RankedFeedItem[]): RankedFeedItem[] {
  const byKey = new Map<string, RankedFeedItem>();
  for (const item of items) {
    const key = feedKey(item);
    const existing = byKey.get(key);
    if (!existing || item.score > existing.score) byKey.set(key, item);
  }
  return [...byKey.values()];
}

// Медиана по артисту (не по элементу): артист с несколькими релизами не должен
// перекашивать распределение своей же повторной популярностью.
function medianPlays30dByArtist(items: readonly RankedFeedItem[]): number {
  const byArtist = new Map<string, number>();
  for (const item of items) {
    const cur = byArtist.get(item.artistProfileId);
    if (cur === undefined || item.plays30d > cur) byArtist.set(item.artistProfileId, item.plays30d);
  }
  const values = [...byArtist.values()].sort((a, b) => a - b);
  if (values.length === 0) return 0;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[mid - 1]! + values[mid]!) / 2 : values[mid]!;
}

export interface ComposeFeedOptions {
  limit?: number;
  maxPerArtist?: number;
  smallArtistShare?: number;
}

export function composeFeed(
  candidates: readonly RankedFeedItem[],
  opts: ComposeFeedOptions = {},
): RankedFeedItem[] {
  const limit = opts.limit ?? DEFAULT_COMPOSE_LIMIT;
  const maxPerArtist = opts.maxPerArtist ?? DEFAULT_MAX_PER_ARTIST;
  const smallArtistShare = opts.smallArtistShare ?? DEFAULT_SMALL_ARTIST_SHARE;
  if (limit <= 0) return [];

  const sorted = dedupeKeepingBestScore(candidates).sort((a, b) => b.score - a.score);
  if (sorted.length === 0) return [];

  const median = medianPlays30dByArtist(sorted);
  const isSmallArtist = (item: RankedFeedItem) => item.plays30d < median;
  const hasSmallArtist = sorted.some(isSmallArtist);
  const smallQuota = hasSmallArtist ? Math.ceil(limit * smallArtistShare) : 0;

  const perArtistCount = new Map<string, number>();
  const selectedKeys = new Set<string>();
  const selected: RankedFeedItem[] = [];
  let selectedSmallCount = 0;

  const tryAdd = (item: RankedFeedItem): boolean => {
    if ((perArtistCount.get(item.artistProfileId) ?? 0) >= maxPerArtist) return false;
    selected.push(item);
    selectedKeys.add(feedKey(item));
    perArtistCount.set(item.artistProfileId, (perArtistCount.get(item.artistProfileId) ?? 0) + 1);
    if (isSmallArtist(item)) selectedSmallCount += 1;
    return true;
  };

  // Проход 1 — закрывает квоту малым лучшими по score малыми кандидатами первыми;
  // иначе высокий score крупных артистов вытесняет их до достижения лимита.
  if (smallQuota > 0) {
    for (const item of sorted) {
      if (selectedSmallCount >= smallQuota || selected.length >= limit) break;
      if (isSmallArtist(item)) tryAdd(item);
    }
  }

  // Проход 2 — добивает остаток по score, независимо от размера артиста.
  for (const item of sorted) {
    if (selected.length >= limit) break;
    if (selectedKeys.has(feedKey(item))) continue;
    tryAdd(item);
  }

  return selected.sort((a, b) => b.score - a.score);
}

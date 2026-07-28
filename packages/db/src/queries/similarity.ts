import { and, desc, eq, inArray, isNotNull, notInArray, sql } from 'drizzle-orm';
import { createTtlCache, tasteOverlapScore, type DiscoveryCandidate, type TasteSignature } from '@vire/core';
import { db } from '../client';
import { artistProfiles, playEvents, tracks, releases, trackGenres, trackMoods, follows } from '../schema';
import { expandGenresToFamilies } from '../genre-families';
import type { TrackGenre } from './track-genres';
import type { Mood } from './track-moods';
import { getTasteProfile } from './taste';
import { listFriends } from './friendships';

// самопересечение play_events — самое тяжёлое место в проекте, поэтому окно,
// порог общих слушателей и размеры пулов кандидатов зафиксированы дизайном
const SIMILARITY_WINDOW = sql`interval '90 days'`;
const MIN_COMMON_LISTENERS = 2;
const TOP_TASTE_ARTISTS = 3;

const similarArtistsCache = createTtlCache<string, DiscoveryCandidate[]>({ ttlMs: 10 * 60_000, maxSize: 500 });
const discoveryCandidatesCache = createTtlCache<string, DiscoveryCandidate[]>({ ttlMs: 10 * 60_000, maxSize: 500 });

export function clearSimilarityCache(): void {
  similarArtistsCache.clear();
  discoveryCandidatesCache.clear();
}

interface CoListenRow {
  artistProfileId: string;
  coListen: number;
}

interface ArtistInfo {
  slug: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
}

// Jaccard по множествам слушателей за 90 дней: сперва пересечение среди слушателей
// sourceArtistId (ограничивает объём сканирования), затем точечный подсчёт тотала
// только для найденных кандидатов — не скан всех play_events.
async function coListenCandidates(
  sourceArtistId: string,
  excludeArtistIds: readonly string[],
  limit: number,
): Promise<CoListenRow[]> {
  const sourceListeners = db
    .selectDistinct({ userId: playEvents.userId })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(and(
      eq(releases.artistProfileId, sourceArtistId),
      isNotNull(playEvents.userId),
      sql`${playEvents.startedAt} >= now() - ${SIMILARITY_WINDOW}`,
    ));

  const excludeIds = [sourceArtistId, ...excludeArtistIds];

  const overlapRows = await db
    .select({
      artistProfileId: releases.artistProfileId,
      intersection: sql<number>`count(distinct ${playEvents.userId})::int`,
    })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(
      eq(artistProfiles.isActive, true),
      isNotNull(playEvents.userId),
      sql`${playEvents.startedAt} >= now() - ${SIMILARITY_WINDOW}`,
      inArray(playEvents.userId, sourceListeners),
      notInArray(releases.artistProfileId, excludeIds),
    ))
    .groupBy(releases.artistProfileId)
    .having(sql`count(distinct ${playEvents.userId}) >= ${MIN_COMMON_LISTENERS}`)
    .orderBy(desc(sql`count(distinct ${playEvents.userId})`))
    .limit(limit);

  if (overlapRows.length === 0) return [];

  const candidateIds = overlapRows.map((r) => r.artistProfileId);

  const [totalsRows, [sourceTotalRow]] = await Promise.all([
    db
      .select({
        artistProfileId: releases.artistProfileId,
        total: sql<number>`count(distinct ${playEvents.userId})::int`,
      })
      .from(playEvents)
      .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .where(and(
        inArray(releases.artistProfileId, candidateIds),
        isNotNull(playEvents.userId),
        sql`${playEvents.startedAt} >= now() - ${SIMILARITY_WINDOW}`,
      ))
      .groupBy(releases.artistProfileId),
    db
      .select({ n: sql<number>`count(distinct ${playEvents.userId})::int` })
      .from(playEvents)
      .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .where(and(
        eq(releases.artistProfileId, sourceArtistId),
        isNotNull(playEvents.userId),
        sql`${playEvents.startedAt} >= now() - ${SIMILARITY_WINDOW}`,
      )),
  ]);

  const sourceTotal = sourceTotalRow?.n ?? 0;
  const totalsByArtist = new Map(totalsRows.map((r) => [r.artistProfileId, r.total]));

  return overlapRows.map((row) => {
    const candidateTotal = totalsByArtist.get(row.artistProfileId) ?? row.intersection;
    const union = sourceTotal + candidateTotal - row.intersection;
    return { artistProfileId: row.artistProfileId, coListen: union > 0 ? row.intersection / union : 0 };
  });
}

async function friendListenedArtists(
  friendIds: readonly string[],
  excludeArtistIds: readonly string[],
  limit: number,
): Promise<Array<{ artistProfileId: string; friendListeners: number }>> {
  if (friendIds.length === 0) return [];
  return db
    .select({
      artistProfileId: releases.artistProfileId,
      friendListeners: sql<number>`count(distinct ${playEvents.userId})::int`,
    })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(
      inArray(playEvents.userId, [...friendIds]),
      eq(artistProfiles.isActive, true),
      sql`${playEvents.startedAt} >= now() - ${SIMILARITY_WINDOW}`,
      excludeArtistIds.length > 0 ? notInArray(releases.artistProfileId, [...excludeArtistIds]) : undefined,
    ))
    .groupBy(releases.artistProfileId)
    .orderBy(desc(sql`count(distinct ${playEvents.userId})`))
    .limit(limit);
}

// Два простых запроса (жанр, настроение), не один OR-джойн — trackGenres/trackMoods
// разные таблицы, объединять через OR по обеим потребовало бы дубли строк с одинаковым артистом
async function tasteMatchingArtistIds(
  genreFamilies: readonly TrackGenre[],
  moods: readonly Mood[],
  excludeArtistIds: readonly string[],
  limit: number,
): Promise<string[]> {
  const exclude = excludeArtistIds.length > 0 ? notInArray(releases.artistProfileId, [...excludeArtistIds]) : undefined;

  const [genreRows, moodRows] = await Promise.all([
    genreFamilies.length > 0
      ? db
          .selectDistinct({ artistProfileId: releases.artistProfileId })
          .from(trackGenres)
          .innerJoin(tracks, eq(tracks.id, trackGenres.trackId))
          .innerJoin(releases, eq(releases.id, tracks.releaseId))
          .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
          .where(and(inArray(trackGenres.genre, [...genreFamilies]), eq(artistProfiles.isActive, true), exclude))
          .limit(limit)
      : Promise.resolve([]),
    moods.length > 0
      ? db
          .selectDistinct({ artistProfileId: releases.artistProfileId })
          .from(trackMoods)
          .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
          .innerJoin(releases, eq(releases.id, tracks.releaseId))
          .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
          .where(and(inArray(trackMoods.mood, [...moods]), eq(artistProfiles.isActive, true), exclude))
          .limit(limit)
      : Promise.resolve([]),
  ]);

  return [...new Set([...genreRows.map((r) => r.artistProfileId), ...moodRows.map((r) => r.artistProfileId)])].slice(0, limit);
}

async function getArtistInfo(artistProfileIds: readonly string[]): Promise<Map<string, ArtistInfo>> {
  if (artistProfileIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: artistProfiles.id,
      slug: artistProfiles.slug,
      name: artistProfiles.name,
      avatarUrl: artistProfiles.avatarUrl,
      verified: artistProfiles.verified,
    })
    .from(artistProfiles)
    .where(inArray(artistProfiles.id, [...artistProfileIds]));
  return new Map(rows.map((r) => [r.id, r]));
}

// Один агрегат для жанров + один для настроений по всему списку id — не подзапрос на артиста.
async function getArtistTasteSignatures(artistProfileIds: readonly string[]): Promise<Map<string, TasteSignature>> {
  if (artistProfileIds.length === 0) return new Map();
  const ids = [...artistProfileIds];

  const [genreRows, moodRows] = await Promise.all([
    db
      .selectDistinct({ artistProfileId: releases.artistProfileId, genre: trackGenres.genre })
      .from(trackGenres)
      .innerJoin(tracks, eq(tracks.id, trackGenres.trackId))
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .where(inArray(releases.artistProfileId, ids)),
    db
      .selectDistinct({ artistProfileId: releases.artistProfileId, mood: trackMoods.mood })
      .from(trackMoods)
      .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .where(inArray(releases.artistProfileId, ids)),
  ]);

  const genresByArtist = new Map<string, Set<TrackGenre>>();
  const moodsByArtist = new Map<string, Set<Mood>>();
  for (const id of ids) {
    genresByArtist.set(id, new Set());
    moodsByArtist.set(id, new Set());
  }
  for (const row of genreRows) genresByArtist.get(row.artistProfileId)?.add(row.genre);
  for (const row of moodRows) moodsByArtist.get(row.artistProfileId)?.add(row.mood);

  const result = new Map<string, TasteSignature>();
  for (const id of ids) {
    result.set(id, {
      genres: expandGenresToFamilies([...(genresByArtist.get(id) ?? [])]),
      moods: [...(moodsByArtist.get(id) ?? [])],
    });
  }
  return result;
}

/** Похожие на конкретного артиста (для страницы артиста): co-listen + пересечение жанров/настроений. */
export function getSimilarArtists(artistProfileId: string, limit: number): Promise<DiscoveryCandidate[]> {
  return similarArtistsCache.get(`${artistProfileId}:${limit}`, async () => {
    const coListenRows = await coListenCandidates(artistProfileId, [], limit);
    if (coListenRows.length === 0) return [];

    const candidateIds = coListenRows.map((r) => r.artistProfileId);
    const [infoById, sigById] = await Promise.all([
      getArtistInfo(candidateIds),
      getArtistTasteSignatures([...candidateIds, artistProfileId]),
    ]);
    const sourceSignature = sigById.get(artistProfileId) ?? { genres: [], moods: [] };

    return coListenRows.flatMap((row): DiscoveryCandidate[] => {
      const info = infoById.get(row.artistProfileId);
      if (!info) return [];
      const signature = sigById.get(row.artistProfileId) ?? { genres: [], moods: [] };
      return [{
        artistProfileId: row.artistProfileId,
        artistSlug: info.slug,
        artistName: info.name,
        artistAvatarUrl: info.avatarUrl,
        verified: info.verified,
        coListen: row.coListen,
        tasteOverlap: tasteOverlapScore(signature, sourceSignature),
        friendListeners: 0,
        sourceArtistId: artistProfileId,
      }];
    });
  });
}

async function getFollowedArtistIds(userId: string): Promise<string[]> {
  const rows = await db.select({ artistProfileId: follows.artistProfileId }).from(follows).where(eq(follows.userId, userId));
  return rows.map((r) => r.artistProfileId);
}

async function getListenedArtistIds(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ artistProfileId: releases.artistProfileId })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(eq(playEvents.userId, userId));
  return rows.map((r) => r.artistProfileId);
}

/**
 * Кандидаты для «Открытий» на главной: похожие на топ-артистов вкуса (co-listen),
 * слушаемые друзьями за 90 дней, совпадение по жанрам/настроениям вкуса —
 * исключая подписки и уже слушанных. Каждому кандидату проставлены все три
 * сигнала (не только тот, что его нашёл) — оценивает `scoreDiscoveryArtist` из @vire/core.
 */
export function getDiscoveryCandidates(userId: string, limit: number): Promise<DiscoveryCandidate[]> {
  return discoveryCandidatesCache.get(`${userId}:${limit}`, async () => {
    const taste = await getTasteProfile(userId);
    const [followedIds, listenedIds, friends] = await Promise.all([
      getFollowedArtistIds(userId),
      getListenedArtistIds(userId),
      listFriends(userId),
    ]);
    const excludeIds = [...new Set([...followedIds, ...listenedIds])];
    const friendIds = friends.map((f) => f.id);
    const seedArtistIds = taste.topArtistIds.slice(0, TOP_TASTE_ARTISTS);
    const genreFamilies = expandGenresToFamilies(taste.topGenres);

    const [coListenBuckets, friendRows, tasteGenreIds] = await Promise.all([
      Promise.all(seedArtistIds.map(async (seedId) => {
        const rows = await coListenCandidates(seedId, excludeIds, limit);
        return rows.map((r) => ({ ...r, sourceArtistId: seedId }));
      })),
      friendListenedArtists(friendIds, excludeIds, limit),
      tasteMatchingArtistIds(genreFamilies, taste.topMoods, excludeIds, limit),
    ]);

    // при нескольких seed-артистах на один кандидат берём лучший co-listen и его источник
    const coListenByArtist = new Map<string, { coListen: number; sourceArtistId: string }>();
    for (const row of coListenBuckets.flat()) {
      const existing = coListenByArtist.get(row.artistProfileId);
      if (!existing || row.coListen > existing.coListen) {
        coListenByArtist.set(row.artistProfileId, { coListen: row.coListen, sourceArtistId: row.sourceArtistId });
      }
    }
    const friendListenersByArtist = new Map(friendRows.map((r) => [r.artistProfileId, r.friendListeners]));

    const mergedIds = [...new Set([
      ...coListenByArtist.keys(),
      ...friendListenersByArtist.keys(),
      ...tasteGenreIds,
    ])];
    if (mergedIds.length === 0) return [];

    const [infoById, sigById] = await Promise.all([
      getArtistInfo(mergedIds),
      getArtistTasteSignatures(mergedIds),
    ]);
    const userSignature: TasteSignature = { genres: genreFamilies, moods: taste.topMoods };

    return mergedIds.flatMap((id): DiscoveryCandidate[] => {
      const info = infoById.get(id);
      if (!info) return [];
      const coListenEntry = coListenByArtist.get(id);
      const signature = sigById.get(id) ?? { genres: [], moods: [] };
      return [{
        artistProfileId: id,
        artistSlug: info.slug,
        artistName: info.name,
        artistAvatarUrl: info.avatarUrl,
        verified: info.verified,
        coListen: coListenEntry?.coListen ?? 0,
        tasteOverlap: tasteOverlapScore(signature, userSignature),
        friendListeners: friendListenersByArtist.get(id) ?? 0,
        sourceArtistId: coListenEntry?.sourceArtistId ?? id,
      }];
    });
  });
}

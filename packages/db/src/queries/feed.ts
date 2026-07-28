import { and, asc, desc, eq, exists, gt, inArray, notInArray, or, isNotNull, sql } from 'drizzle-orm';
import type { FeedCandidate } from '@vire/core';
import { db } from '../client';
import { follows, artistProfiles, releases, tracks, trackGenres, trackMoods, artistPosts, playEvents } from '../schema';
import { getTasteProfile } from './taste';
import { releaseIsAired, releaseFreshness } from './discovery';

const releaseFeedColumns = {
  id: releases.id,
  artistProfileId: releases.artistProfileId,
  artistSlug: artistProfiles.slug,
  artistName: artistProfiles.name,
  artistAvatarUrl: artistProfiles.avatarUrl,
  title: releases.title,
  coverUrl: releases.coverUrl,
  releaseType: releases.type,
  // Любой трек релиза explicit (см. discovery.releaseCardColumns).
  hasExplicit: sql<boolean>`exists (select 1 from "tracks" t where t.release_id = "releases".id and t.is_explicit)`,
};

interface ReleaseFeedRow {
  id: string;
  artistProfileId: string;
  artistSlug: string;
  artistName: string;
  artistAvatarUrl: string | null;
  title: string;
  coverUrl: string | null;
  releaseType: string;
  hasExplicit: boolean;
  occurredAt: Date;
}

interface PostFeedRow {
  id: string;
  artistProfileId: string;
  artistSlug: string;
  artistName: string;
  artistAvatarUrl: string | null;
  occurredAt: Date;
  title: string | null;
  body: string;
}

async function getGenresMoodsForReleases(
  releaseIds: string[],
): Promise<Map<string, { genres: string[]; moods: string[] }>> {
  const map = new Map<string, { genres: string[]; moods: string[] }>();
  if (releaseIds.length === 0) return map;
  for (const id of releaseIds) map.set(id, { genres: [], moods: [] });

  const [genreRows, moodRows] = await Promise.all([
    db
      .selectDistinct({ releaseId: tracks.releaseId, genre: trackGenres.genre })
      .from(trackGenres)
      .innerJoin(tracks, eq(tracks.id, trackGenres.trackId))
      .where(inArray(tracks.releaseId, releaseIds)),
    db
      .selectDistinct({ releaseId: tracks.releaseId, mood: trackMoods.mood })
      .from(trackMoods)
      .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
      .where(inArray(tracks.releaseId, releaseIds)),
  ]);
  for (const row of genreRows) map.get(row.releaseId)?.genres.push(row.genre);
  for (const row of moodRows) map.get(row.releaseId)?.moods.push(row.mood);
  return map;
}

/** Один агрегат по всем собранным id вместо коррелированного подзапроса на строку. */
async function getPlays30dForReleases(releaseIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (releaseIds.length === 0) return map;
  for (const id of releaseIds) map.set(id, 0);

  const rows = await db
    .select({ releaseId: tracks.releaseId, plays: sql<number>`count(*)::int` })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .where(and(inArray(tracks.releaseId, releaseIds), sql`${playEvents.startedAt} >= now() - interval '30 days'`))
    .groupBy(tracks.releaseId);
  for (const row of rows) map.set(row.releaseId, row.plays);
  return map;
}

function toReleaseCandidate(
  row: ReleaseFeedRow,
  kind: 'RELEASE' | 'UPCOMING',
  isFollowed: boolean,
  genresMoods: Map<string, { genres: string[]; moods: string[] }>,
  plays30d: Map<string, number>,
): FeedCandidate {
  return {
    kind,
    id: row.id,
    artistProfileId: row.artistProfileId,
    artistSlug: row.artistSlug,
    artistName: row.artistName,
    artistAvatarUrl: row.artistAvatarUrl,
    occurredAt: row.occurredAt,
    isFollowed,
    genres: genresMoods.get(row.id)?.genres ?? [],
    moods: genresMoods.get(row.id)?.moods ?? [],
    plays30d: plays30d.get(row.id) ?? 0,
    title: row.title,
    coverUrl: row.coverUrl,
    hasExplicit: row.hasExplicit,
    releaseType: row.releaseType,
    body: null,
  };
}

function toPostCandidate(row: PostFeedRow): FeedCandidate {
  return {
    kind: 'POST',
    id: row.id,
    artistProfileId: row.artistProfileId,
    artistSlug: row.artistSlug,
    artistName: row.artistName,
    artistAvatarUrl: row.artistAvatarUrl,
    occurredAt: row.occurredAt,
    isFollowed: true,
    genres: [],
    moods: [],
    plays30d: 0,
    title: row.title ?? row.artistName,
    coverUrl: null,
    hasExplicit: false,
    releaseType: null,
    body: row.body,
  };
}

const FOLLOW_RELEASE_LIMIT = 60;
const TASTE_ARTIST_RELEASE_LIMIT = 40;
const TASTE_GENRE_MOOD_RELEASE_LIMIT = 40;
const FOLLOW_POST_LIMIT = 30;
const FOLLOW_UPCOMING_LIMIT = 20;

/**
 * Сырьё для ленты (stage-2 §4.2): релизы подписок + релизы по вкусу (артист/жанр/
 * настроение) + анонсы подписок за 30 дней + скорые релизы подписок. Ранжирование
 * и композиция — в @vire/core (feed-ranking), здесь только сбор кандидатов.
 */
export async function getFeedCandidates(userId: string, limit = 120): Promise<FeedCandidate[]> {
  const taste = await getTasteProfile(userId);

  const followReleasesQuery = db
    .select({ ...releaseFeedColumns, occurredAt: releaseFreshness })
    .from(releases)
    .innerJoin(follows, eq(follows.artistProfileId, releases.artistProfileId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(eq(follows.userId, userId), eq(artistProfiles.isActive, true), releaseIsAired))
    .orderBy(desc(releaseFreshness))
    .limit(FOLLOW_RELEASE_LIMIT);

  const tasteArtistReleasesQuery = taste.topArtistIds.length > 0
    ? db
      .select({ ...releaseFeedColumns, occurredAt: releaseFreshness })
      .from(releases)
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(and(
        inArray(releases.artistProfileId, taste.topArtistIds),
        eq(artistProfiles.isActive, true),
        releaseIsAired,
      ))
      .orderBy(desc(releaseFreshness))
      .limit(TASTE_ARTIST_RELEASE_LIMIT)
    : Promise.resolve([]);

  const genreMoodConds = [
    taste.topGenres.length > 0
      ? exists(
        db.select({ one: sql`1` }).from(trackGenres)
          .innerJoin(tracks, eq(tracks.id, trackGenres.trackId))
          .where(and(eq(tracks.releaseId, releases.id), inArray(trackGenres.genre, taste.topGenres))),
      )
      : null,
    taste.topMoods.length > 0
      ? exists(
        db.select({ one: sql`1` }).from(trackMoods)
          .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
          .where(and(eq(tracks.releaseId, releases.id), inArray(trackMoods.mood, taste.topMoods))),
      )
      : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null);

  const tasteGenreMoodReleasesQuery = genreMoodConds.length > 0
    ? db
      .select({ ...releaseFeedColumns, occurredAt: releaseFreshness })
      .from(releases)
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(and(eq(artistProfiles.isActive, true), releaseIsAired, or(...genreMoodConds)))
      .orderBy(desc(releaseFreshness))
      .limit(TASTE_GENRE_MOOD_RELEASE_LIMIT)
    : Promise.resolve([]);

  const followPostsQuery = db
    .select({
      id: artistPosts.id,
      artistProfileId: artistPosts.artistProfileId,
      artistSlug: artistProfiles.slug,
      artistName: artistProfiles.name,
      artistAvatarUrl: artistProfiles.avatarUrl,
      occurredAt: artistPosts.createdAt,
      title: artistPosts.title,
      body: artistPosts.body,
    })
    .from(artistPosts)
    .innerJoin(follows, eq(follows.artistProfileId, artistPosts.artistProfileId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, artistPosts.artistProfileId))
    .where(and(
      eq(follows.userId, userId),
      eq(artistProfiles.isActive, true),
      sql`${artistPosts.createdAt} >= now() - interval '30 days'`,
    ))
    .orderBy(desc(artistPosts.createdAt))
    .limit(FOLLOW_POST_LIMIT);

  const followUpcomingQuery = db
    .select({ ...releaseFeedColumns, occurredAt: releases.releaseDate })
    .from(releases)
    .innerJoin(follows, eq(follows.artistProfileId, releases.artistProfileId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(
      eq(follows.userId, userId),
      eq(artistProfiles.isActive, true),
      eq(releases.status, 'SCHEDULED'),
      isNotNull(releases.releaseDate),
      gt(releases.releaseDate, sql`now()`),
    ))
    .orderBy(asc(releases.releaseDate))
    .limit(FOLLOW_UPCOMING_LIMIT);

  const [followReleaseRows, tasteArtistRows, tasteGenreMoodRows, postRows, upcomingRows] = await Promise.all([
    followReleasesQuery,
    tasteArtistReleasesQuery,
    tasteGenreMoodReleasesQuery,
    followPostsQuery,
    followUpcomingQuery,
  ]);

  const followedReleaseIds = new Set(followReleaseRows.map((r) => r.id));
  const mergedReleases = new Map<string, ReleaseFeedRow>();
  for (const row of [...followReleaseRows, ...tasteArtistRows, ...tasteGenreMoodRows]) {
    if (!mergedReleases.has(row.id)) mergedReleases.set(row.id, row);
  }

  const upcomingCandidateRows: ReleaseFeedRow[] = upcomingRows.map((r) => ({ ...r, occurredAt: r.occurredAt! }));

  const allReleaseIds = [...mergedReleases.keys(), ...upcomingCandidateRows.map((r) => r.id)];
  const [genresMoods, plays30d] = await Promise.all([
    getGenresMoodsForReleases(allReleaseIds),
    getPlays30dForReleases(allReleaseIds),
  ]);

  const releaseCandidates = [...mergedReleases.values()].map((row) =>
    toReleaseCandidate(row, 'RELEASE', followedReleaseIds.has(row.id), genresMoods, plays30d));
  const upcomingCandidates = upcomingCandidateRows.map((row) =>
    toReleaseCandidate(row, 'UPCOMING', true, genresMoods, plays30d));
  const postCandidates = postRows.map(toPostCandidate);

  // Сортировка по близости к "сейчас" перед срезом лимита пула: иначе при
  // переполнении релизами хвост среза всегда съедает анонсы/скорые релизы
  // просто потому, что они позже в конкатенации, а не потому что менее свежие.
  const now = Date.now();
  return [...releaseCandidates, ...upcomingCandidates, ...postCandidates]
    .sort((a, b) => Math.abs(a.occurredAt.getTime() - now) - Math.abs(b.occurredAt.getTime() - now))
    .slice(0, limit);
}

const EMPTY_GENRES_MOODS = new Map<string, { genres: string[]; moods: string[] }>();
const EMPTY_PLAYS = new Map<string, number>();

/** Добивка холодного старта (< 6 элементов в композиции): просто свежие вышедшие релизы, reason='fresh' на стороне вызывающего. */
export async function getFreshFeedCandidates(excludeReleaseIds: string[], limit: number): Promise<FeedCandidate[]> {
  if (limit <= 0) return [];
  const conds = [eq(artistProfiles.isActive, true), releaseIsAired];
  if (excludeReleaseIds.length > 0) conds.push(notInArray(releases.id, excludeReleaseIds));

  const rows = await db
    .select({ ...releaseFeedColumns, occurredAt: releaseFreshness })
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(...conds))
    .orderBy(desc(releaseFreshness))
    .limit(limit);

  return rows.map((row) => toReleaseCandidate(row, 'RELEASE', false, EMPTY_GENRES_MOODS, EMPTY_PLAYS));
}

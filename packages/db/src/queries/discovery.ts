import { and, asc, count, desc, eq, gt, inArray, isNotNull, lte, notInArray, or, sql } from 'drizzle-orm';
import type { ReleaseCard } from '@vire/core';
import { db } from '../client';
import { artistProfiles, playEvents, releases, tracks, likes, follows } from '../schema';
import { getTasteProfile } from './taste';
import { featFromCredits } from './track-credits';

export type DiscoveryRelease = ReleaseCard;

const releaseCardColumns = {
  id: releases.id,
  title: releases.title,
  type: releases.type,
  coverUrl: releases.coverUrl,
  releaseDate: releases.releaseDate,
  artistName: artistProfiles.name,
  artistSlug: artistProfiles.slug,
  artistAvatarUrl: artistProfiles.avatarUrl,
  hasExplicit: sql<boolean>`exists (select 1 from "tracks" t where t.release_id = "releases".id and t.is_explicit)`,
  accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
};

export interface DiscoveryTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
  version: string | null;
  feat: string[];
}

/** Для поверхностей, что отдают доменный Release без explicit-данных (страница артиста): один запрос вместо N. */
export async function getExplicitReleaseIds(releaseIds: string[]): Promise<Set<string>> {
  if (releaseIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ releaseId: tracks.releaseId })
    .from(tracks)
    .where(and(inArray(tracks.releaseId, releaseIds), eq(tracks.isExplicit, true)));
  return new Set(rows.map((r) => r.releaseId));
}

/** Публично слышимые треки по списку id (для секции «Сейчас слушают»). */
export async function getTracksByIds(ids: string[]): Promise<DiscoveryTrack[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      releaseId: releases.id,
      coverUrl: releases.coverUrl,
      accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
      version: tracks.version,
      credits: tracks.credits,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        inArray(tracks.id, ids),
        eq(tracks.status, 'READY'),
        eq(artistProfiles.isActive, true),
        or(
          eq(releases.status, 'PUBLISHED'),
          and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
        ),
      ),
    );
  return rows.map(({ credits, ...r }) => ({ ...r, feat: featFromCredits(credits) }));
}

export async function getLatestReleases(limit = 12): Promise<DiscoveryRelease[]> {
  return db
    .select(releaseCardColumns)
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(artistProfiles.isActive, true),
        or(
          eq(releases.status, 'PUBLISHED'),
          and(
            eq(releases.status, 'SCHEDULED'),
            isNotNull(releases.releaseDate),
            lte(releases.releaseDate, sql`now()`),
          ),
        ),
      ),
    )
    // Свежесть = момент выхода в эфир: published_at, иначе release_date (план,
    // открывшийся по дате), иначе created_at (легаси-строки без обоих).
    .orderBy(desc(sql`coalesce(${releases.publishedAt}, ${releases.releaseDate}, ${releases.createdAt})`))
    .limit(limit);
}

export interface ReleaseCardStats {
  trackCount: number;
  totalDurationSec: number;
}

export async function getReleaseCardStats(releaseId: string): Promise<ReleaseCardStats> {
  const [row] = await db
    .select({
      trackCount: sql<number>`count(*)::int`,
      totalDurationSec: sql<number>`coalesce(sum(${tracks.durationSec}), 0)::int`,
    })
    .from(tracks)
    .where(and(eq(tracks.releaseId, releaseId), eq(tracks.status, 'READY')));
  return row ?? { trackCount: 0, totalDurationSec: 0 };
}

// Релиз слышен (опубликован / запланирован с прошедшей датой), тот же предикат,
// что в getLatestReleases; вынесен для переиспользования в каталоге и в ленте.
export const releaseIsAired = or(
  eq(releases.status, 'PUBLISHED'),
  and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
);

// Момент выхода в эфир: published_at → release_date → created_at (см. getLatestReleases).
export const releaseFreshness = sql<Date>`coalesce(${releases.publishedAt}, ${releases.releaseDate}, ${releases.createdAt})`;

export interface ArtistPlayableTrack {
  id: string;
  title: string;
  releaseId: string;
  coverUrl: string | null;
  durationSec: number | null;
  isExplicit: boolean;
  plays: number;
  version: string | null;
  feat: string[];
}

/** Для play-all и ридаута на странице артиста: один запрос вместо N fetch'ей по релизам. */
export async function getArtistPlayableTracks(artistProfileId: string): Promise<ArtistPlayableTrack[]> {
  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      releaseId: releases.id,
      coverUrl: releases.coverUrl,
      durationSec: tracks.durationSec,
      isExplicit: tracks.isExplicit,
      plays: count(playEvents.id),
      version: tracks.version,
      credits: tracks.credits,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .leftJoin(playEvents, eq(playEvents.trackId, tracks.id))
    .where(and(eq(releases.artistProfileId, artistProfileId), eq(tracks.status, 'READY'), releaseIsAired))
    .groupBy(tracks.id, releases.id)
    .orderBy(desc(releaseFreshness), asc(tracks.trackNumber))
    .limit(300);
  return rows.map(({ credits, ...r }) => ({ ...r, plays: Number(r.plays), feat: featFromCredits(credits) }));
}

export type ReleaseSort = 'fresh' | 'popular';

/** `popular` — сортировка по прослушиваниям треков релиза, не по популярности артиста. */
export async function listReleases({
  sort = 'fresh',
  sinceDays,
  limit = 60,
  offset = 0,
}: {
  sort?: ReleaseSort;
  sinceDays?: number;
  limit?: number;
  offset?: number;
} = {}): Promise<DiscoveryRelease[]> {
  const conds = [eq(artistProfiles.isActive, true), releaseIsAired];
  if (sinceDays) {
    // sinceDays - внутреннее число, не пользовательский ввод; бинд-параметр в interval
    // Postgres не типизирует, поэтому вставляем литералом: now() - interval 'N days'.
    const days = Math.max(0, Math.floor(sinceDays));
    conds.push(sql`${releaseFreshness} >= now() - ${sql.raw(`interval '${days} days'`)}`);
  }

  if (sort === 'popular') {
    // Прослушивания релиза = play-events его треков; left join оставляет в выдаче
    // релизы без прослушиваний (с нулём); group by по PK, остальные колонки зависят от него.
    return db
      .select(releaseCardColumns)
      .from(releases)
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .leftJoin(tracks, eq(tracks.releaseId, releases.id))
      .leftJoin(playEvents, eq(playEvents.trackId, tracks.id))
      .where(and(...conds))
      .groupBy(releases.id, artistProfiles.id)
      .orderBy(desc(count(playEvents.id)), desc(releaseFreshness), desc(releases.id))
      .limit(limit)
      .offset(offset);
  }

  return db
    .select(releaseCardColumns)
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(...conds))
    .orderBy(desc(releaseFreshness), desc(releases.id))
    .limit(limit)
    .offset(offset);
}

/** Грядущие релизы конкретного артиста (для страницы артиста / countdown). */
export async function getUpcomingByArtist(artistProfileId: string): Promise<DiscoveryRelease[]> {
  return db
    .select(releaseCardColumns)
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(artistProfiles.id, artistProfileId),
        eq(releases.status, 'SCHEDULED'),
        isNotNull(releases.releaseDate),
        gt(releases.releaseDate, sql`now()`),
      ),
    )
    .orderBy(asc(releases.releaseDate));
}

/** Грядущие релизы: запланированы с датой в будущем («скоро выйдет»). */
export async function getUpcomingReleases(limit = 8): Promise<DiscoveryRelease[]> {
  return db
    .select(releaseCardColumns)
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(artistProfiles.isActive, true),
        eq(releases.status, 'SCHEDULED'),
        isNotNull(releases.releaseDate),
        gt(releases.releaseDate, sql`now()`),
      ),
    )
    .orderBy(asc(releases.releaseDate))
    .limit(limit);
}

export interface PlayableChartTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  durationSec: number | null;
  accentColor: string | null;
  isExplicit: boolean;
  plays: number;
  version: string | null;
  feat: string[];
}

const playableTrackColumns = {
  id: tracks.id,
  title: tracks.title,
  artistName: artistProfiles.name,
  artistSlug: artistProfiles.slug,
  releaseId: releases.id,
  coverUrl: releases.coverUrl,
  durationSec: tracks.durationSec,
  accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
  isExplicit: tracks.isExplicit,
  version: tracks.version,
  credits: tracks.credits,
};

/** Публичный чарт: самые слушаемые READY-треки за N дней. */
export async function getPopularTracks(days = 30, limit = 20): Promise<PlayableChartTrack[]> {
  const rows = await db
    .select({ ...playableTrackColumns, plays: count(playEvents.id) })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(
      sql`${playEvents.startedAt} >= now() - make_interval(days => ${days})`,
      eq(tracks.status, 'READY'),
      eq(artistProfiles.isActive, true),
      releaseIsAired,
    ))
    .groupBy(tracks.id, tracks.title, artistProfiles.name, artistProfiles.slug, releases.id, releases.coverUrl, tracks.durationSec, artistProfiles.themeTokens, tracks.isExplicit, tracks.version, tracks.credits)
    .orderBy(desc(count(playEvents.id)))
    .limit(limit);
  return rows.map(({ credits, ...r }) => ({ ...r, plays: Number(r.plays), feat: featFromCredits(credits) }));
}

/** «Продолжить слушать»: недавно игранные юзером READY-треки, без повторов, свежие сверху. */
export async function getRecentlyPlayed(userId: string, limit = 12): Promise<PlayableChartTrack[]> {
  const rows = await db
    .select(playableTrackColumns)
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(
      eq(playEvents.userId, userId),
      eq(tracks.status, 'READY'),
      eq(artistProfiles.isActive, true),
      releaseIsAired,
    ))
    .groupBy(tracks.id, tracks.title, artistProfiles.name, artistProfiles.slug, releases.id, releases.coverUrl, tracks.durationSec, artistProfiles.themeTokens, tracks.isExplicit, tracks.version, tracks.credits)
    .orderBy(desc(sql`max(${playEvents.startedAt})`))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id, title: r.title, artistName: r.artistName, artistSlug: r.artistSlug,
    releaseId: r.releaseId, coverUrl: r.coverUrl, durationSec: r.durationSec, accentColor: r.accentColor,
    isExplicit: r.isExplicit, plays: 0, version: r.version, feat: featFromCredits(r.credits),
  }));
}

/** «Для тебя», подробности алгоритма: docs/features/home-feed.md. */
export async function getPersonalTrackPicks(userId: string, limit = 12): Promise<PlayableChartTrack[]> {
  const taste = await getTasteProfile(userId);

  // Артисты интереса: из лайкнутых треков ∪ из подписок ∪ из профиля вкуса.
  const likedArtists = db
    .select({ artistProfileId: releases.artistProfileId })
    .from(likes)
    .innerJoin(tracks, eq(tracks.id, likes.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(eq(likes.userId, userId));
  const followedArtists = db
    .select({ artistProfileId: follows.artistProfileId })
    .from(follows)
    .where(eq(follows.userId, userId));

  const likedTrackIds = db
    .select({ trackId: likes.trackId })
    .from(likes)
    .where(eq(likes.userId, userId));
  const recentlyPlayedTrackIds = db
    .select({ trackId: playEvents.trackId })
    .from(playEvents)
    .where(and(eq(playEvents.userId, userId), sql`${playEvents.startedAt} >= now() - interval '14 days'`));

  const artistOfInterest = [
    inArray(releases.artistProfileId, likedArtists),
    inArray(releases.artistProfileId, followedArtists),
  ];
  if (taste.topArtistIds.length > 0) {
    artistOfInterest.push(inArray(releases.artistProfileId, taste.topArtistIds));
  }

  const rows = await db
    .select({ ...playableTrackColumns, plays: count(playEvents.id) })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .leftJoin(playEvents, eq(playEvents.trackId, tracks.id))
    .where(and(
      eq(tracks.status, 'READY'),
      eq(artistProfiles.isActive, true),
      releaseIsAired,
      or(...artistOfInterest),
      notInArray(tracks.id, likedTrackIds),
      notInArray(tracks.id, recentlyPlayedTrackIds),
    ))
    .groupBy(tracks.id, tracks.title, artistProfiles.name, artistProfiles.slug, releases.id, releases.coverUrl, tracks.durationSec, artistProfiles.themeTokens, tracks.isExplicit, tracks.version, tracks.credits, releaseFreshness)
    .orderBy(desc(releaseFreshness), desc(count(playEvents.id)))
    .limit(limit);
  return rows.map(({ credits, ...r }) => ({ ...r, plays: Number(r.plays), feat: featFromCredits(credits) }));
}

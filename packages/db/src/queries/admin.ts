import { and, asc, count, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import { db } from '../client';
import {
  users, artistProfiles, releases, tracks, trackAudio, playEvents,
  likes, follows, playlists, artistPosts, trackMoods, favoriteMoments,
} from '../schema';
import type { UserRole } from './admin-types';

export type { UserRole };

export interface AdminStats {
  totalUsers: number;
  totalArtists: number;
  totalTracks: number;
  totalReleases: number;
  tracksProcessing: number;
  tracksReady: number;
  tracksBlocked: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [[userCount], [artistCount], trackCounts, [releaseCount]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(artistProfiles),
    db.select({ status: tracks.status, n: count() }).from(tracks).groupBy(tracks.status),
    db.select({ n: count() }).from(releases),
  ]);

  const byStatus = Object.fromEntries(trackCounts.map((r) => [r.status, Number(r.n)]));

  return {
    totalUsers: Number(userCount?.n ?? 0),
    totalArtists: Number(artistCount?.n ?? 0),
    totalTracks: trackCounts.reduce((s, r) => s + Number(r.n), 0),
    totalReleases: Number(releaseCount?.n ?? 0),
    tracksProcessing: byStatus['PROCESSING'] ?? 0,
    tracksReady: byStatus['READY'] ?? 0,
    tracksBlocked: byStatus['BLOCKED'] ?? 0,
  };
}

/** Пинг базы: латентность в мс или null при недоступности (для health-панели админки). */
export async function pingDb(): Promise<number | null> {
  try {
    const t0 = Date.now();
    await db.execute(sql`select 1`);
    return Date.now() - t0;
  } catch {
    return null;
  }
}

// ─── Platform metrics (полный обзор) ───────────────────────────────────────

export interface AdminPlatformMetrics {
  usersByRole: Record<string, number>;
  newUsers7d: number;
  artistsActive: number;
  artistsVerified: number;
  releasesByStatus: Record<string, number>;
  plays24h: number;
  plays7d: number;
  plays30d: number;
  playsTotal: number;
  uniqueListeners7d: number;
  likesTotal: number;
  likes7d: number;
  followsTotal: number;
  follows7d: number;
  playlistsTotal: number;
  postsTotal: number;
  moodTagsTotal: number;
  momentsTotal: number;
}

export async function getAdminPlatformMetrics(): Promise<AdminPlatformMetrics> {
  const [roleRows, [newUsers], [artistAgg], releaseRows, [playAgg], [likeAgg], [followAgg], [pl], [posts], [moods], [moments]] =
    await Promise.all([
      db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
      db.select({ n: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '7 days')::int` }).from(users),
      db.select({
        active: sql<number>`count(*) filter (where ${artistProfiles.isActive})::int`,
        verified: sql<number>`count(*) filter (where ${artistProfiles.verified})::int`,
      }).from(artistProfiles),
      db.select({ status: releases.status, n: count() }).from(releases).groupBy(releases.status),
      db.select({
        d24: sql<number>`count(*) filter (where ${playEvents.startedAt} >= now() - interval '24 hours')::int`,
        d7: sql<number>`count(*) filter (where ${playEvents.startedAt} >= now() - interval '7 days')::int`,
        d30: sql<number>`count(*) filter (where ${playEvents.startedAt} >= now() - interval '30 days')::int`,
        total: count(),
        uniq7: sql<number>`count(distinct ${playEvents.sessionId}) filter (where ${playEvents.startedAt} >= now() - interval '7 days')::int`,
      }).from(playEvents),
      db.select({
        total: count(),
        d7: sql<number>`count(*) filter (where ${likes.createdAt} >= now() - interval '7 days')::int`,
      }).from(likes),
      db.select({
        total: count(),
        d7: sql<number>`count(*) filter (where ${follows.createdAt} >= now() - interval '7 days')::int`,
      }).from(follows),
      db.select({ n: count() }).from(playlists),
      db.select({ n: count() }).from(artistPosts),
      db.select({ n: count() }).from(trackMoods),
      db.select({ n: count() }).from(favoriteMoments),
    ]);

  return {
    usersByRole: Object.fromEntries(roleRows.map((r) => [r.role, Number(r.n)])),
    newUsers7d: Number(newUsers?.n ?? 0),
    artistsActive: Number(artistAgg?.active ?? 0),
    artistsVerified: Number(artistAgg?.verified ?? 0),
    releasesByStatus: Object.fromEntries(releaseRows.map((r) => [r.status, Number(r.n)])),
    plays24h: Number(playAgg?.d24 ?? 0),
    plays7d: Number(playAgg?.d7 ?? 0),
    plays30d: Number(playAgg?.d30 ?? 0),
    playsTotal: Number(playAgg?.total ?? 0),
    uniqueListeners7d: Number(playAgg?.uniq7 ?? 0),
    likesTotal: Number(likeAgg?.total ?? 0),
    likes7d: Number(likeAgg?.d7 ?? 0),
    followsTotal: Number(followAgg?.total ?? 0),
    follows7d: Number(followAgg?.d7 ?? 0),
    playlistsTotal: Number(pl?.n ?? 0),
    postsTotal: Number(posts?.n ?? 0),
    moodTagsTotal: Number(moods?.n ?? 0),
    momentsTotal: Number(moments?.n ?? 0),
  };
}

// ─── Platform analytics (топы и динамика) ──────────────────────────────────

export interface AdminDailyPlays {
  day: string; // YYYY-MM-DD
  plays: number;
  listeners: number;
}

/** Прослушивания по дням за последние N дней (включая дни без событий). */
export async function getAdminDailyPlays(days = 14): Promise<AdminDailyPlays[]> {
  const rows = await db.execute(sql`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
           count(pe.id)::int AS plays,
           count(DISTINCT pe.session_id)::int AS listeners
    FROM generate_series(
      date_trunc('day', now()) - make_interval(days => ${days - 1}),
      date_trunc('day', now()),
      interval '1 day'
    ) AS d(day)
    LEFT JOIN play_events pe
      ON pe.started_at >= d.day AND pe.started_at < d.day + interval '1 day'
    GROUP BY d.day
    ORDER BY d.day
  `);
  return (rows as unknown as Array<{ day: string; plays: number; listeners: number }>).map((r) => ({
    day: r.day,
    plays: Number(r.plays),
    listeners: Number(r.listeners),
  }));
}

export interface AdminTopTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  plays: number;
  listeners: number;
}

export async function getAdminTopTracks(days = 30, limit = 10): Promise<AdminTopTrack[]> {
  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      releaseId: releases.id,
      plays: count(playEvents.id),
      listeners: sql<number>`count(distinct ${playEvents.sessionId})::int`,
    })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(sql`${playEvents.startedAt} >= now() - make_interval(days => ${days})`)
    .groupBy(tracks.id, tracks.title, artistProfiles.name, artistProfiles.slug, releases.id)
    .orderBy(desc(count(playEvents.id)))
    .limit(limit);
  return rows.map((r) => ({ ...r, plays: Number(r.plays), listeners: Number(r.listeners) }));
}

export interface AdminTopArtist {
  id: string;
  name: string;
  slug: string;
  plays: number;
  listeners: number;
}

export async function getAdminTopArtists(days = 30, limit = 10): Promise<AdminTopArtist[]> {
  const rows = await db
    .select({
      id: artistProfiles.id,
      name: artistProfiles.name,
      slug: artistProfiles.slug,
      plays: count(playEvents.id),
      listeners: sql<number>`count(distinct ${playEvents.sessionId})::int`,
    })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(sql`${playEvents.startedAt} >= now() - make_interval(days => ${days})`)
    .groupBy(artistProfiles.id, artistProfiles.name, artistProfiles.slug)
    .orderBy(desc(count(playEvents.id)))
    .limit(limit);
  return rows.map((r) => ({ ...r, plays: Number(r.plays), listeners: Number(r.listeners) }));
}

// ─── Artists (управление) ──────────────────────────────────────────────────

export interface AdminArtist {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  isActive: boolean;
  createdAt: Date;
  followerCount: number;
  releaseCount: number;
  trackCount: number;
  plays30d: number;
}

export async function listArtistsAdmin(opts: { search?: string; limit?: number; offset?: number } = {}): Promise<AdminArtist[]> {
  const { search, limit = 50, offset = 0 } = opts;
  const rows = await db
    .select({
      id: artistProfiles.id,
      name: artistProfiles.name,
      slug: artistProfiles.slug,
      verified: artistProfiles.verified,
      isActive: artistProfiles.isActive,
      createdAt: artistProfiles.createdAt,
      // Внешняя таблица в подзапросах указана литералом: drizzle рендерит
      // интерполированную колонку без квалификации («id»), и внутри подзапроса
      // с другими таблицами она становится неоднозначной.
      followerCount: sql<number>`(select count(*) from follows f where f.artist_profile_id = artist_profiles.id)::int`,
      releaseCount: sql<number>`(select count(*) from releases r where r.artist_profile_id = artist_profiles.id)::int`,
      trackCount: sql<number>`(select count(*) from tracks t join releases r on r.id = t.release_id where r.artist_profile_id = artist_profiles.id)::int`,
      plays30d: sql<number>`(
        select count(*) from play_events pe
        join tracks t on t.id = pe.track_id
        join releases r on r.id = t.release_id
        where r.artist_profile_id = artist_profiles.id
          and pe.started_at >= now() - interval '30 days'
      )::int`,
    })
    .from(artistProfiles)
    .where(
      search
        ? or(ilike(artistProfiles.name, `%${search}%`), ilike(artistProfiles.slug, `%${search}%`))
        : undefined,
    )
    .orderBy(desc(artistProfiles.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    followerCount: Number(r.followerCount),
    releaseCount: Number(r.releaseCount),
    trackCount: Number(r.trackCount),
    plays30d: Number(r.plays30d),
  }));
}

/** Скрыть/показать артиста на витрине (isActive фильтруется во всех публичных запросах). */
export async function setArtistActive(artistProfileId: string, isActive: boolean): Promise<void> {
  await db
    .update(artistProfiles)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(artistProfiles.id, artistProfileId));
}

// ─── Attention items ───────────────────────────────────────────────────────

export interface StuckTrack {
  id: string;
  title: string;
  releaseTitle: string;
  artistSlug: string;
  releaseId: string;
  updatedAt: Date;
}

export interface UnverifiedArtist {
  profileId: string;
  name: string;
  slug: string;
  publishedCount: number;
}

export interface AdminAttention {
  stuckTracks: StuckTrack[];
  blockedTracksCount: number;
  unverifiedArtists: UnverifiedArtist[];
}

export async function getAdminAttention(): Promise<AdminAttention> {
  const [stuckRows, [blockedRow], unverifiedRows] = await Promise.all([
    // Треки, которые зависли в PROCESSING больше 2 часов
    db
      .select({
        id: tracks.id,
        title: tracks.title,
        releaseTitle: releases.title,
        artistSlug: artistProfiles.slug,
        releaseId: releases.id,
        updatedAt: tracks.updatedAt,
      })
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(
        and(
          eq(tracks.status, 'PROCESSING'),
          lt(tracks.updatedAt, sql`now() - interval '2 hours'`),
        ),
      )
      .orderBy(asc(tracks.updatedAt))
      .limit(10),

    // Количество заблокированных треков
    db.select({ n: count() }).from(tracks).where(eq(tracks.status, 'BLOCKED')),

    // Артисты с опубликованными релизами, но без верификации
    db
      .select({
        profileId: artistProfiles.id,
        name: artistProfiles.name,
        slug: artistProfiles.slug,
        publishedCount: count(releases.id),
      })
      .from(artistProfiles)
      .innerJoin(
        releases,
        and(
          eq(releases.artistProfileId, artistProfiles.id),
          eq(releases.status, 'PUBLISHED'),
        ),
      )
      .where(eq(artistProfiles.verified, false))
      .groupBy(artistProfiles.id, artistProfiles.name, artistProfiles.slug)
      .orderBy(desc(count(releases.id)))
      .limit(5),
  ]);

  return {
    stuckTracks: stuckRows,
    blockedTracksCount: Number(blockedRow?.n ?? 0),
    unverifiedArtists: unverifiedRows.map((r) => ({
      ...r,
      publishedCount: Number(r.publishedCount),
    })),
  };
}

// ─── Recent activity ───────────────────────────────────────────────────────

export interface AdminRecentRelease {
  id: string;
  title: string;
  type: string;
  artistName: string;
  artistSlug: string;
  updatedAt: Date;
}

export async function getRecentPublishedReleases(limit = 8): Promise<AdminRecentRelease[]> {
  return db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      updatedAt: releases.updatedAt,
    })
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(eq(releases.status, 'PUBLISHED'))
    .orderBy(desc(releases.updatedAt))
    .limit(limit);
}

// ─── Users ─────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date;
  artistSlug: string | null;
  artistVerified: boolean | null;
  artistProfileId: string | null;
}

export async function listUsersAdmin(opts: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminUser[]> {
  const { search, limit = 50, offset = 0 } = opts;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      artistSlug: artistProfiles.slug,
      artistVerified: artistProfiles.verified,
      artistProfileId: artistProfiles.id,
    })
    .from(users)
    .leftJoin(artistProfiles, eq(artistProfiles.userId, users.id))
    .where(
      search
        ? or(
            ilike(users.email, `%${search}%`),
            ilike(users.name, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function verifyArtist(artistProfileId: string, verified: boolean): Promise<void> {
  await db
    .update(artistProfiles)
    .set({ verified, updatedAt: new Date() })
    .where(eq(artistProfiles.id, artistProfileId));
}

// ─── Tracks ────────────────────────────────────────────────────────────────

export interface AdminTrack {
  id: string;
  title: string;
  status: string;
  trackNumber: number;
  createdAt: Date;
  releaseTitle: string;
  releaseId: string;
  artistName: string;
  artistSlug: string;
  durationSec: number | null;
  bpm: number | null;
  musicalKey: string | null;
  hasHls: boolean;
  playsTotal: number;
  likesCount: number;
}

export async function listTracksAdmin(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminTrack[]> {
  const { status, limit = 50, offset = 0 } = opts;

  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      status: tracks.status,
      trackNumber: tracks.trackNumber,
      createdAt: tracks.createdAt,
      releaseTitle: releases.title,
      releaseId: releases.id,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      durationSec: tracks.durationSec,
      bpm: trackAudio.bpm,
      musicalKey: trackAudio.musicalKey,
      hasHls: sql<boolean>`${trackAudio.hlsManifestKey} is not null`,
      // tracks.id литералом: интерполяция в select-контексте рендерится как «id»
      // и внутри подзапроса резолвится в id его собственной таблицы (pe.id/l.id)
      playsTotal: sql<number>`(select count(*) from play_events pe where pe.track_id = tracks.id)::int`,
      likesCount: sql<number>`(select count(*) from likes l where l.track_id = tracks.id)::int`,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .leftJoin(trackAudio, eq(trackAudio.trackId, tracks.id))
    .where(status ? eq(tracks.status, status as 'PROCESSING' | 'READY' | 'BLOCKED') : undefined)
    .orderBy(desc(tracks.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    hasHls: Boolean(r.hasHls),
    playsTotal: Number(r.playsTotal),
    likesCount: Number(r.likesCount),
  }));
}

export async function setTrackStatus(
  trackId: string,
  status: 'READY' | 'BLOCKED' | 'PROCESSING',
): Promise<void> {
  await db.update(tracks).set({ status, updatedAt: new Date() }).where(eq(tracks.id, trackId));
}

// ─── Releases ──────────────────────────────────────────────────────────────

export interface AdminRelease {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: Date;
  releaseDate: Date | null;
  artistName: string;
  artistSlug: string;
  trackCount: number;
}

export async function listReleasesAdmin(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminRelease[]> {
  const { status, limit = 50, offset = 0 } = opts;

  const rows = await db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      status: releases.status,
      createdAt: releases.createdAt,
      releaseDate: releases.releaseDate,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      trackCount: count(tracks.id),
    })
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .leftJoin(tracks, eq(tracks.releaseId, releases.id))
    .where(
      status
        ? eq(releases.status, status as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED')
        : undefined,
    )
    .groupBy(releases.id, artistProfiles.name, artistProfiles.slug)
    .orderBy(desc(releases.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({ ...r, trackCount: Number(r.trackCount) }));
}

export async function setReleaseStatus(
  releaseId: string,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
): Promise<void> {
  await db.update(releases).set({ status, updatedAt: new Date() }).where(eq(releases.id, releaseId));
}

import { and, asc, count, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import { db } from '../client';
import {
  users, artistProfiles, artistMembers, releases, tracks, trackAudio, playEvents,
  likes, follows, playlists, playlistTracks, artistPosts, trackMoods, favoriteMoments,
  rightsHolders,
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

// Раньше — 4 коррелированных подзапроса, пересчитываемых на каждую из 50 строк
// (200 сканов на страницу). Теперь — 4 предагрегированных LEFT JOIN: каждая
// таблица (follows/releases/tracks/play_events) агрегируется по artist_profile_id
// ОДИН раз (GROUP BY, использует существующие индексы *_artist_profile_id_idx /
// *_release_id_idx / play_events_track_started_covering_idx), затем хеш-джойнится со
// страницей артистов — один проход по каждой таблице вместо N.
// Разные имена count-колонки в каждом подзапросе (не переиспользуем «cnt») —
// иначе interpolated-колонка в sql-шаблоне ниже рендерится без квалификации
// таблицы и Postgres не может выбрать между четырьмя одноимёнными «cnt».
const artistFollowerAgg = db
  .select({ artistProfileId: follows.artistProfileId, followerCnt: sql<number>`count(*)`.as('follower_cnt') })
  .from(follows)
  .groupBy(follows.artistProfileId)
  .as('artist_follower_agg');

const artistReleaseAgg = db
  .select({ artistProfileId: releases.artistProfileId, releaseCnt: sql<number>`count(*)`.as('release_cnt') })
  .from(releases)
  .groupBy(releases.artistProfileId)
  .as('artist_release_agg');

const artistTrackAgg = db
  .select({ artistProfileId: releases.artistProfileId, trackCnt: sql<number>`count(*)`.as('track_cnt') })
  .from(tracks)
  .innerJoin(releases, eq(releases.id, tracks.releaseId))
  .groupBy(releases.artistProfileId)
  .as('artist_track_agg');

const artistPlays30dAgg = db
  .select({ artistProfileId: releases.artistProfileId, playsCnt: sql<number>`count(*)`.as('plays_cnt') })
  .from(playEvents)
  .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
  .innerJoin(releases, eq(releases.id, tracks.releaseId))
  .where(sql`${playEvents.startedAt} >= now() - interval '30 days'`)
  .groupBy(releases.artistProfileId)
  .as('artist_plays30d_agg');

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
      followerCount: sql<number>`coalesce(${artistFollowerAgg.followerCnt}, 0)::int`,
      releaseCount: sql<number>`coalesce(${artistReleaseAgg.releaseCnt}, 0)::int`,
      trackCount: sql<number>`coalesce(${artistTrackAgg.trackCnt}, 0)::int`,
      plays30d: sql<number>`coalesce(${artistPlays30dAgg.playsCnt}, 0)::int`,
    })
    .from(artistProfiles)
    .leftJoin(artistFollowerAgg, eq(artistFollowerAgg.artistProfileId, artistProfiles.id))
    .leftJoin(artistReleaseAgg, eq(artistReleaseAgg.artistProfileId, artistProfiles.id))
    .leftJoin(artistTrackAgg, eq(artistTrackAgg.artistProfileId, artistProfiles.id))
    .leftJoin(artistPlays30dAgg, eq(artistPlays30dAgg.artistProfileId, artistProfiles.id))
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

/** Базовые поля профиля артиста для админ-редактуры (§9.1). */
export async function getArtistCore(
  id: string,
): Promise<{ id: string; name: string; slug: string; bio: string | null; avatarUrl: string | null } | null> {
  const [row] = await db
    .select({
      id: artistProfiles.id,
      name: artistProfiles.name,
      slug: artistProfiles.slug,
      bio: artistProfiles.bio,
      avatarUrl: artistProfiles.avatarUrl,
    })
    .from(artistProfiles)
    .where(eq(artistProfiles.id, id))
    .limit(1);
  return row ?? null;
}

/** Полная админ-редактура профиля артиста, включая slug (он уникален → ловим конфликт). */
export async function adminUpdateArtist(
  id: string,
  data: { name: string; slug: string; bio: string | null; avatarUrl: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db
      .update(artistProfiles)
      .set({ name: data.name, slug: data.slug, bio: data.bio, avatarUrl: data.avatarUrl, updatedAt: new Date() })
      .where(eq(artistProfiles.id, id));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Не удалось сохранить — возможно, slug уже занят' };
  }
}

// ─── Посты и плейлисты для админ-редактуры (§9.1) ────────────────────────────

export interface AdminPost {
  id: string;
  title: string | null;
  body: string;
  artistName: string;
  artistSlug: string;
  createdAt: Date;
}

export async function listPostsAdmin(limit = 100): Promise<AdminPost[]> {
  const rows = await db
    .select({
      id: artistPosts.id,
      title: artistPosts.title,
      body: artistPosts.body,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      createdAt: artistPosts.createdAt,
    })
    .from(artistPosts)
    .innerJoin(artistProfiles, eq(artistProfiles.id, artistPosts.artistProfileId))
    .orderBy(desc(artistPosts.createdAt))
    .limit(limit);
  return rows;
}

export interface AdminPlaylist {
  id: string;
  title: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  kind: string;
  isCurated: boolean;
  ownerEmail: string | null;
  trackCount: number;
  likesCount: number;
  createdAt: Date;
}

export async function listPlaylistsAdmin(limit = 100): Promise<AdminPlaylist[]> {
  const rows = await db
    .select({
      id: playlists.id,
      title: playlists.title,
      visibility: playlists.visibility,
      kind: playlists.kind,
      isCurated: playlists.isCurated,
      ownerEmail: users.email,
      likesCount: playlists.likesCount,
      createdAt: playlists.createdAt,
      trackCount: sql<number>`(select count(*) from playlist_tracks pt where pt.playlist_id = playlists.id)`,
    })
    .from(playlists)
    .leftJoin(users, eq(users.id, playlists.ownerUserId))
    .orderBy(desc(playlists.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, trackCount: Number(r.trackCount) }));
}

export async function adminUpdatePlaylist(
  id: string,
  data: { title: string; visibility: 'PRIVATE' | 'PUBLIC' },
): Promise<void> {
  await db
    .update(playlists)
    .set({ title: data.title, visibility: data.visibility })
    .where(eq(playlists.id, id));
}

/** Удаление плейлиста админом. playlist_tracks не каскадит — чистим в транзакции;
 *  playlist_likes удалятся каскадом по FK. */
export async function adminDeletePlaylist(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(playlistTracks).where(eq(playlistTracks.playlistId, id));
    await tx.delete(playlists).where(eq(playlists.id, id));
  });
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
  failedTracks: StuckTrack[];
  blockedTracksCount: number;
  unverifiedArtists: UnverifiedArtist[];
}

export async function getAdminAttention(): Promise<AdminAttention> {
  const [stuckRows, failedRows, [blockedRow], unverifiedRows] = await Promise.all([
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

    // Треки, у которых транскодинг окончательно упал (FAILED) — артист уже
    // уведомлён письмом, но админу стоит видеть для разбора.
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
      .where(eq(tracks.status, 'FAILED'))
      .orderBy(desc(tracks.updatedAt))
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
    failedTracks: failedRows,
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
  email: string | null;
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
  status: 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED',
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

// ─── Create Artist ──────────────────────────────────────────────────────────

export async function createArtistForUser(data: {
  email: string;
  name: string;
  slug: string;
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  if (!user) return { ok: false, error: 'Пользователь не найден' };

  // Несколько артистов на один аккаунт разрешены — один человек может управлять
  // несколькими карточками. Уникален только slug (глобально).
  const [slugTaken] = await db.select({ id: artistProfiles.id })
    .from(artistProfiles).where(eq(artistProfiles.slug, data.slug)).limit(1);
  if (slugTaken) return { ok: false, error: `Slug @${data.slug} уже занят` };

  await db.transaction(async (tx) => {
    await tx.insert(rightsHolders).values({ userId: user.id, displayName: data.name });
    const [profile] = await tx.insert(artistProfiles).values({
      userId: user.id,
      slug: data.slug,
      name: data.name,
      isActive: true,
      verified: false,
    }).returning({ id: artistProfiles.id });
    // Создатель — OWNER-участник: контроль доступа к дашборду идёт через artist_members.
    await tx.insert(artistMembers).values({
      artistProfileId: profile.id,
      userId: user.id,
      role: 'OWNER',
    });
    // Повышаем до ARTIST только обычного слушателя — модератора/админа/суперадмина
    // не понижаем (иначе создание артиста на своём же email отбирает доступ к админке).
    if (user.role === 'LISTENER') {
      await tx.update(users).set({ role: 'ARTIST', updatedAt: new Date() }).where(eq(users.id, user.id));
    }
  });

  return { ok: true, slug: data.slug };
}

// ─── Участники артист-профиля (несколько аккаунтов на профиль) ────────────────

export interface ArtistMemberRow {
  userId: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: Date;
}

export async function listArtistMembers(artistProfileId: string): Promise<ArtistMemberRow[]> {
  return db
    .select({
      userId: artistMembers.userId,
      email: users.email,
      name: users.name,
      role: artistMembers.role,
      createdAt: artistMembers.createdAt,
    })
    .from(artistMembers)
    .innerJoin(users, eq(users.id, artistMembers.userId))
    .where(eq(artistMembers.artistProfileId, artistProfileId))
    // OWNER сверху, далее по дате добавления.
    .orderBy(desc(eq(artistMembers.role, 'OWNER')), asc(artistMembers.createdAt));
}

/** Привязывает существующий аккаунт (по email) к профилю как MEMBER. Идемпотентно по уникальности. */
export async function addArtistMember(
  artistProfileId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!user) return { ok: false, error: 'Пользователь с таким email не найден' };

  const [existing] = await db
    .select({ id: artistMembers.id })
    .from(artistMembers)
    .where(and(eq(artistMembers.artistProfileId, artistProfileId), eq(artistMembers.userId, user.id)))
    .limit(1);
  if (existing) return { ok: false, error: 'Этот аккаунт уже участник' };

  await db.transaction(async (tx) => {
    await tx.insert(artistMembers).values({ artistProfileId, userId: user.id, role: 'MEMBER' });
    // Доступ к дашборду требует роли ARTIST; обычного слушателя повышаем (как в createArtistForUser).
    if (user.role === 'LISTENER') {
      await tx.update(users).set({ role: 'ARTIST', updatedAt: new Date() }).where(eq(users.id, user.id));
    }
  });
  return { ok: true };
}

/** Снимает участника. OWNER удалить нельзя (профиль не должен остаться без владельца). */
export async function removeArtistMember(
  artistProfileId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [m] = await db
    .select({ role: artistMembers.role })
    .from(artistMembers)
    .where(and(eq(artistMembers.artistProfileId, artistProfileId), eq(artistMembers.userId, userId)))
    .limit(1);
  if (!m) return { ok: false, error: 'Не участник' };
  if (m.role === 'OWNER') return { ok: false, error: 'Нельзя удалить владельца' };

  await db
    .delete(artistMembers)
    .where(and(eq(artistMembers.artistProfileId, artistProfileId), eq(artistMembers.userId, userId)));
  return { ok: true };
}

import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../client';
import { users, artistProfiles, releases, tracks, playEvents, likes, follows, playlists, artistPosts, trackMoods, favoriteMoments } from '../schema';

// Числа для обзора и /admin/analytics: агрегаты по всей платформе и топы за период.
// Модерационные действия — в соседних admin-*.ts.

export async function pingDb(): Promise<number | null> {
  try {
    const t0 = Date.now();
    await db.execute(sql`select 1`);
    return Date.now() - t0;
  } catch {
    return null;
  }
}

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


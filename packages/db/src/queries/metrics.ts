import { desc, sql } from 'drizzle-orm';
import { db } from '../client';
import { platformMetricsDaily } from '../schema';

export interface PlatformMetricsDay {
  day: string;
  users: number;
  artists: number;
  releasesPublished: number;
  tracksReady: number;
  plays: number;
  listeners: number;
  likesTotal: number;
  followsTotal: number;
  playlistsTotal: number;
  postsTotal: number;
}

/** Идемпотентный дневной снапшот: тоталы кумулятивны на конец дня, plays/listeners — за этот день. */
export async function snapshotPlatformMetricsDaily(day: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO platform_metrics_daily (
      day, users, artists, releases_published, tracks_ready,
      plays, listeners, likes_total, follows_total, playlists_total, posts_total
    )
    SELECT
      ${day}::date,
      (SELECT count(*) FROM users WHERE created_at < ${day}::date + interval '1 day')::int,
      (SELECT count(*) FROM artist_profiles WHERE created_at < ${day}::date + interval '1 day')::int,
      (SELECT count(*) FROM releases WHERE published_at IS NOT NULL AND published_at < ${day}::date + interval '1 day')::int,
      (SELECT count(*) FROM tracks WHERE status = 'READY' AND updated_at < ${day}::date + interval '1 day')::int,
      (SELECT count(*) FROM play_events WHERE started_at >= ${day}::date AND started_at < ${day}::date + interval '1 day')::int,
      (SELECT count(DISTINCT session_id) FROM play_events WHERE started_at >= ${day}::date AND started_at < ${day}::date + interval '1 day')::int,
      (SELECT count(*) FROM likes WHERE created_at < ${day}::date + interval '1 day')::int,
      (SELECT count(*) FROM follows WHERE created_at < ${day}::date + interval '1 day')::int,
      (SELECT count(*) FROM playlists WHERE created_at < ${day}::date + interval '1 day')::int,
      (SELECT count(*) FROM artist_posts WHERE created_at < ${day}::date + interval '1 day')::int
    ON CONFLICT (day) DO UPDATE SET
      users = excluded.users,
      artists = excluded.artists,
      releases_published = excluded.releases_published,
      tracks_ready = excluded.tracks_ready,
      plays = excluded.plays,
      listeners = excluded.listeners,
      likes_total = excluded.likes_total,
      follows_total = excluded.follows_total,
      playlists_total = excluded.playlists_total,
      posts_total = excluded.posts_total
  `);
}

/** Последние N дней истории, по возрастанию дня (для графиков роста). */
export async function getPlatformMetricsHistory(days: number): Promise<PlatformMetricsDay[]> {
  const rows = await db
    .select({
      day: sql<string>`to_char(${platformMetricsDaily.day}, 'YYYY-MM-DD')`,
      users: platformMetricsDaily.users,
      artists: platformMetricsDaily.artists,
      releasesPublished: platformMetricsDaily.releasesPublished,
      tracksReady: platformMetricsDaily.tracksReady,
      plays: platformMetricsDaily.plays,
      listeners: platformMetricsDaily.listeners,
      likesTotal: platformMetricsDaily.likesTotal,
      followsTotal: platformMetricsDaily.followsTotal,
      playlistsTotal: platformMetricsDaily.playlistsTotal,
      postsTotal: platformMetricsDaily.postsTotal,
    })
    .from(platformMetricsDaily)
    .orderBy(desc(platformMetricsDaily.day))
    .limit(days);
  return rows.reverse();
}

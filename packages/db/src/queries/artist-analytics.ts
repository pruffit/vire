import { count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../client';
import { playEvents, tracks, releases } from '../schema';

export interface TrackPlayStat {
  trackId: string;
  trackTitle: string;
  releaseId: string;
  releaseTitle: string;
  totalPlays: number;
  plays7d: number;
  totalListenedSec: number;
}

export interface ArtistPlayStats {
  tracks: TrackPlayStat[];
  totalPlays: number;
  totalPlays7d: number;
}

export async function getArtistPlayStats(artistProfileId: string): Promise<ArtistPlayStats> {
  const rows = await db
    .select({
      trackId: tracks.id,
      trackTitle: tracks.title,
      releaseId: releases.id,
      releaseTitle: releases.title,
      totalPlays: count(playEvents.id),
      // Compute the 7-day cutoff in SQL — interpolating a JS Date as a bound
      // parameter crashes the postgres.js driver (ERR_INVALID_ARG_TYPE).
      plays7d: sql<number>`count(case when ${playEvents.startedAt} >= now() - interval '7 days' then 1 end)::int`,
      totalListenedSec: sql<number>`coalesce(sum(${playEvents.durationPlayedSec}), 0)::int`,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .leftJoin(playEvents, eq(playEvents.trackId, tracks.id))
    .where(eq(releases.artistProfileId, artistProfileId))
    .groupBy(tracks.id, tracks.title, releases.id, releases.title)
    .orderBy(desc(count(playEvents.id)))
    .limit(10);

  const trackStats = rows.map((r) => ({
    ...r,
    totalPlays: Number(r.totalPlays),
    plays7d: Number(r.plays7d),
    totalListenedSec: Number(r.totalListenedSec),
  }));

  const totalPlays = trackStats.reduce((s, t) => s + t.totalPlays, 0);
  const totalPlays7d = trackStats.reduce((s, t) => s + t.plays7d, 0);

  return { tracks: trackStats, totalPlays, totalPlays7d };
}

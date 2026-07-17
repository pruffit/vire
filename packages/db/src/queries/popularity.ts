import { desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../client';
import { tracks, releases, artistProfiles } from '../schema';
import { visibleTrackWhere } from './wave';
import type { PlaylistCandidate } from './editorial-policy';

/** Число прослушиваний трека за последние `days` дней: коррелированный подзапрос, ссылается на внешний tracks.id. */
export function playsCountSql(days: number): SQL<number> {
  const window = Math.max(0, Math.floor(days));
  return sql<number>`(
    SELECT COUNT(*)::float FROM play_events pc
    WHERE pc.track_id = tracks.id AND pc.started_at >= now() - ${sql.raw(`interval '${window} days'`)}
  )`;
}

/** Скор популярности: прослушивания + случайный довесок малого веса, для ротации между прогонами без искажения порядка при больших разрывах. */
export function popularityScoreSql(days: number, randomWeight = 0.4): SQL<number> {
  return sql<number>`${playsCountSql(days)} + random() * ${randomWeight}`;
}

export async function topTrackCandidatesByPlays(days: number, limit: number): Promise<PlaylistCandidate[]> {
  const score = popularityScoreSql(days);
  const rows = await db
    .select({ trackId: tracks.id, artistId: artistProfiles.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(visibleTrackWhere)
    .orderBy(desc(score), desc(releases.releaseDate))
    .limit(limit);
  return rows;
}

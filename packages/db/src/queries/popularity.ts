import { desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../client';
import { tracks, releases, artistProfiles } from '../schema';
import { visibleTrackWhere } from './wave';

/** Число прослушиваний трека за последние `days` дней — коррелированный подзапрос по внешнему tracks.id. */
export function playsCountSql(days: number): SQL<number> {
  const window = Math.max(0, Math.floor(days));
  return sql<number>`(
    SELECT COUNT(*)::float FROM play_events pc
    WHERE pc.track_id = tracks.id AND pc.started_at >= now() - ${sql.raw(`interval '${window} days'`)}
  )`;
}

/**
 * Скор для ранжирования по популярности: прослушивания + случайный довесок малого
 * веса — обеспечивает ротацию между прогонами без искажения порядка по значимым разрывам.
 */
export function popularityScoreSql(days: number, randomWeight = 0.4): SQL<number> {
  return sql<number>`${playsCountSql(days)} + random() * ${randomWeight}`;
}

/**
 * Id видимых треков (READY, релиз вышел, артист активен), ранжированные по
 * прослушиваниям за `days` дней, затем по свежести релиза.
 */
export async function topTrackIdsByPlays(days: number, limit: number): Promise<string[]> {
  const score = popularityScoreSql(days);
  const rows = await db
    .select({ id: tracks.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(visibleTrackWhere)
    .orderBy(desc(score), desc(releases.releaseDate))
    .limit(limit);
  return rows.map((r) => r.id);
}

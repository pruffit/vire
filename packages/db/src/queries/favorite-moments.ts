import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { favoriteMoments } from '../schema';

export interface MomentBucket {
  positionSec: number;
  count: number;
}

/** Агрегирует моменты по позиции (±2 сек бакеты). */
export async function getAggregateMoments(trackId: string): Promise<MomentBucket[]> {
  const rows = await db
    .select({
      positionSec: sql<number>`(${favoriteMoments.positionSec} / 3) * 3`,
      count: count(),
    })
    .from(favoriteMoments)
    .where(eq(favoriteMoments.trackId, trackId))
    .groupBy(sql`(${favoriteMoments.positionSec} / 3) * 3`)
    .orderBy(sql`(${favoriteMoments.positionSec} / 3) * 3`);

  return rows.map((r) => ({ positionSec: Number(r.positionSec), count: Number(r.count) }));
}

export async function addFavoriteMoment(
  trackId: string,
  positionSec: number,
  userId?: string,
): Promise<void> {
  await db.insert(favoriteMoments).values({ trackId, positionSec, userId });
}

export async function getMomentCount(trackId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(favoriteMoments)
    .where(eq(favoriteMoments.trackId, trackId));
  return row ? Number(row.count) : 0;
}

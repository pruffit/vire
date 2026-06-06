import { and, count, eq } from 'drizzle-orm';
import { db } from '../client';
import { likes } from '../schema';

export async function getLikeState(userId: string, trackId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: likes.id })
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.trackId, trackId)))
    .limit(1);
  return !!row;
}

export async function getLikeCount(trackId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(likes)
    .where(eq(likes.trackId, trackId));
  return row?.count ?? 0;
}

export async function likeTrack(userId: string, trackId: string): Promise<void> {
  await db
    .insert(likes)
    .values({ userId, trackId })
    .onConflictDoNothing();
}

export async function unlikeTrack(userId: string, trackId: string): Promise<void> {
  await db
    .delete(likes)
    .where(and(eq(likes.userId, userId), eq(likes.trackId, trackId)));
}

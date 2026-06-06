import { and, count, eq } from 'drizzle-orm';
import { db } from '../client';
import { follows } from '../schema';

export async function getFollowState(
  userId: string,
  artistProfileId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.artistProfileId, artistProfileId)))
    .limit(1);
  return !!row;
}

export async function getFollowerCount(artistProfileId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(follows)
    .where(eq(follows.artistProfileId, artistProfileId));
  return row?.count ?? 0;
}

export async function followArtist(userId: string, artistProfileId: string): Promise<void> {
  await db
    .insert(follows)
    .values({ userId, artistProfileId })
    .onConflictDoNothing();
}

export async function unfollowArtist(userId: string, artistProfileId: string): Promise<void> {
  await db
    .delete(follows)
    .where(and(eq(follows.userId, userId), eq(follows.artistProfileId, artistProfileId)));
}

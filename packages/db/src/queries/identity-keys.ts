import { eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { userIdentityKeys } from '../schema';

export async function upsertIdentityKey(userId: string, ikPub: string): Promise<void> {
  await db
    .insert(userIdentityKeys)
    .values({ userId, ikPub })
    .onConflictDoUpdate({ target: userIdentityKeys.userId, set: { ikPub, updatedAt: new Date() } });
}

export async function getIdentityKey(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ ikPub: userIdentityKeys.ikPub })
    .from(userIdentityKeys)
    .where(eq(userIdentityKeys.userId, userId))
    .limit(1);
  return row?.ikPub ?? null;
}

export async function getIdentityKeys(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: userIdentityKeys.userId, ikPub: userIdentityKeys.ikPub })
    .from(userIdentityKeys)
    .where(inArray(userIdentityKeys.userId, userIds));
  return new Map(rows.map((r) => [r.userId, r.ikPub]));
}

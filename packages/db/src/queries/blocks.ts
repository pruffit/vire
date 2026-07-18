import { and, eq, exists, not, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { db } from '../client';
import { userBlocks, friendships } from '../schema';

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
    // Блок рвёт дружбу/заявку в обе стороны — не сосуществует с friendship-ребром.
    await tx.delete(friendships).where(or(
      and(eq(friendships.requesterId, blockerId), eq(friendships.addresseeId, blockedId)),
      and(eq(friendships.requesterId, blockedId), eq(friendships.addresseeId, blockerId)),
    ));
  });
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(or(
      and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
      and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
    ))
    .limit(1);
  return !!row;
}

export async function listBlockedIds(userId: string): Promise<string[]> {
  const rows = await db.select({ blockedId: userBlocks.blockedId }).from(userBlocks).where(eq(userBlocks.blockerId, userId));
  return rows.map((r) => r.blockedId);
}

// Антиджойн для поиска: TRUE, если между viewerId и otherIdColumn нет блока ни в одну сторону.
export function blockedPairsExpr(viewerId: string, otherIdColumn: AnyColumn): SQL {
  return not(exists(
    db.select({ one: sql`1` }).from(userBlocks).where(or(
      and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, otherIdColumn)),
      and(eq(userBlocks.blockerId, otherIdColumn), eq(userBlocks.blockedId, viewerId)),
    )),
  ));
}

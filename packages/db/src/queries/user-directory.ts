import { and, asc, ilike, isNotNull, ne } from 'drizzle-orm';
import type { UserDirectoryHit } from '@vire/core';
import { db } from '../client';
import { users } from '../schema';
import { blockedPairsExpr } from './blocks';

export async function searchUsersByName(query: string, limit: number, excludeId: string): Promise<UserDirectoryHit[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, image: users.image })
    .from(users)
    .where(and(
      isNotNull(users.name),
      ne(users.id, excludeId),
      ilike(users.name, `%${query}%`),
      // заблокированные (в любую сторону) не находятся в поиске
      blockedPairsExpr(excludeId, users.id),
    ))
    .orderBy(asc(users.name))
    .limit(limit);
  return rows.map((r) => ({ id: r.id, name: r.name!, image: r.image }));
}

import { and, asc, eq, ilike, isNotNull, ne } from 'drizzle-orm';
import type { UserDirectoryHit } from '@vire/core';
import { db } from '../client';
import { users } from '../schema';

export async function searchUsersByName(query: string, limit: number, excludeId: string): Promise<UserDirectoryHit[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, image: users.image })
    .from(users)
    .where(and(isNotNull(users.name), ne(users.id, excludeId), ilike(users.name, `%${query}%`)))
    .orderBy(asc(users.name))
    .limit(limit);
  return rows.map((r) => ({ id: r.id, name: r.name!, image: r.image }));
}

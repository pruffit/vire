import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { users, artistProfiles, playEvents, likes, playlists } from '../schema';
import type { UserRole } from './admin-types';

// Пользователи бэкофиса: список с активностью и смена роли.

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: Date;
  artistSlug: string | null;
  artistVerified: boolean | null;
  artistProfileId: string | null;
}

export async function listUsersAdmin(opts: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminUser[]> {
  const { search, limit = 50, offset = 0 } = opts;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      artistSlug: artistProfiles.slug,
      artistVerified: artistProfiles.verified,
      artistProfileId: artistProfiles.id,
    })
    .from(users)
    .leftJoin(artistProfiles, eq(artistProfiles.userId, users.id))
    .where(
      search
        ? or(
            ilike(users.email, `%${search}%`),
            ilike(users.name, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}


import { db, DrizzleArtistRepository } from '@vire/db';
import type { ArtistProfile } from '@vire/core';

// «Активный артист» дашборда хранится в cookie; без неё — дефолт: первый профиль пользователя.

export const ACTIVE_ARTIST_COOKIE = 'vire_active_artist';

/** Сверяет id с владением, иначе — дефолт (первый профиль). Cookie не даёт доступа к чужому профилю. */
export async function resolveActiveArtist(
  userId: string,
  activeArtistId?: string | null,
): Promise<ArtistProfile | null> {
  const repo = new DrizzleArtistRepository(db);
  if (activeArtistId) {
    const owned = await repo.findByIdForUser(activeArtistId, userId);
    if (owned) return owned;
  }
  return repo.findByUserId(userId);
}

/** Читает выбранного артиста из cookie запроса (для route handlers — без next/headers). */
export function readActiveArtistCookie(req: Request): string | undefined {
  const cookie = req.headers.get('cookie');
  if (!cookie) return undefined;
  const m = cookie.match(/(?:^|;\s*)vire_active_artist=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Активный артист в route handler (читает cookie из Request). */
export async function getActiveArtist(userId: string, req: Request): Promise<ArtistProfile | null> {
  return resolveActiveArtist(userId, readActiveArtistCookie(req));
}

/** Активный артист в серверном компоненте; next/headers импортируется динамически, чтобы модуль был безопасен для юнит-тестов route handlers. */
export async function getActiveArtistForPage(userId: string): Promise<ArtistProfile | null> {
  const { cookies } = await import('next/headers');
  const value = (await cookies()).get(ACTIVE_ARTIST_COOKIE)?.value;
  return resolveActiveArtist(userId, value);
}

/** Все артисты пользователя (для переключателя). */
export async function listUserArtists(userId: string): Promise<ArtistProfile[]> {
  return new DrizzleArtistRepository(db).findAllByUserId(userId);
}

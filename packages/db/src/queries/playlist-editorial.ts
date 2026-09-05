import { and, desc, eq, inArray, isNull, ne, notInArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../client';
import { playlists, playlistTracks } from '../schema';
import type { EditorialParams } from '../schema';
import { hydratePlaylists, META, SHARED_PRIORITY, type EditorialPlaylist } from './playlist-meta';

// Редакционные и личные подборки: их наполняет воркер editorial, а не пользователь.
// Пользовательские плейлисты — в playlists.ts.

/** Общие редакционные подборки: без личных (target_user_id IS NULL) и пользовательских (kind <> 'USER'). */
export async function getEditorialPlaylists(limit = 4): Promise<EditorialPlaylist[]> {
  const rows = await db
    .select(META)
    .from(playlists)
    .where(and(
      eq(playlists.isCurated, true),
      sql`${playlists.targetUserId} IS NULL`,
      sql`${playlists.kind} <> 'USER'`,
    ))
    .orderBy(SHARED_PRIORITY, desc(playlists.likesCount), desc(playlists.updatedAt))
    .limit(limit);
  return hydratePlaylists(rows);
}

/** Личные подборки конкретного юзера (kind=PERSONAL, target_user_id = userId). */
export async function getPersonalPlaylists(userId: string, limit = 4): Promise<EditorialPlaylist[]> {
  const rows = await db
    .select(META)
    .from(playlists)
    .where(eq(playlists.targetUserId, userId))
    .orderBy(desc(playlists.updatedAt))
    .limit(limit);
  return hydratePlaylists(rows);
}

/** Популярные общие подборки: фолбэк для личной половины (гость/новый юзер без сигнала). Исключает уже показанные id. */
export async function getPopularPlaylists(limit: number, excludeIds: string[] = []): Promise<EditorialPlaylist[]> {
  if (limit <= 0) return [];
  const rows = await db
    .select(META)
    .from(playlists)
    .where(and(
      eq(playlists.isCurated, true),
      sql`${playlists.targetUserId} IS NULL`,
      sql`${playlists.kind} <> 'USER'`,
      excludeIds.length > 0 ? notInArray(playlists.id, excludeIds) : sql`true`,
    ))
    .orderBy(desc(playlists.likesCount), desc(playlists.updatedAt))
    .limit(limit);
  return hydratePlaylists(rows);
}

/** Идентичность общей подборки: kind+params. Строки до миграции 0051 (params IS NULL)
 *  подхватываются по прежнему ключу — заголовку, иначе апсерт создал бы дубль, а старую
 *  строку с её лайками снесло бы как stale. */
export function editorialPlaylistIdentity(params: EditorialParams | undefined, title: string): SQL {
  if (!params) return sql`${playlists.editorialParams} IS NULL`;
  return sql`(${playlists.editorialParams}->>'mood' = ${params.mood} OR (${playlists.editorialParams} IS NULL AND ${playlists.title} = ${title}))`;
}

/** Создаёт или обновляет общую редакционную подборку по kind+editorialParams (не title —
 *  тот локализуется на рендере и может не совпадать между прогонами). */
export async function upsertEditorialPlaylist(opts: {
  kind: 'MOOD' | 'TRENDING' | 'RELISTEN' | 'FRESH';
  title: string;
  description?: string;
  editorialParams?: EditorialParams;
  trackIds: string[];
}): Promise<void> {
  const { kind, title, description, editorialParams, trackIds } = opts;

  const existing = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(
      eq(playlists.kind, kind),
      sql`${playlists.targetUserId} IS NULL`,
      editorialPlaylistIdentity(editorialParams, title),
    ))
    .limit(1);

  let playlistId: string;
  if (existing.length > 0) {
    playlistId = existing[0].id;
    await db
      .update(playlists)
      .set({
        title,
        description: description ?? null,
        editorialParams: editorialParams ?? null,
        updatedAt: new Date(),
      })
      .where(eq(playlists.id, playlistId));
    await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlistId));
  } else {
    const [row] = await db
      .insert(playlists)
      .values({
        title,
        description: description ?? null,
        kind,
        editorialParams: editorialParams ?? null,
        visibility: 'PUBLIC',
        isCurated: true,
      })
      .returning({ id: playlists.id });
    playlistId = row.id;
  }

  if (trackIds.length > 0) {
    await db.insert(playlistTracks).values(
      trackIds.map((trackId, i) => ({ playlistId, trackId, position: i })),
    );
  }
}

/** Создаёт личную подборку (kind=PERSONAL). Личные пересобираются целиком: это insert,
 *  не upsert, перед партией вызывай deletePersonalPlaylists. */
export async function createPersonalPlaylist(opts: {
  userId: string;
  title: string;
  description?: string;
  editorialParams?: EditorialParams;
  trackIds: string[];
}): Promise<void> {
  const { userId, title, description, editorialParams, trackIds } = opts;
  if (trackIds.length === 0) return;
  const [row] = await db
    .insert(playlists)
    .values({
      title,
      description: description ?? null,
      kind: 'PERSONAL',
      editorialParams: editorialParams ?? null,
      visibility: 'PUBLIC',
      isCurated: true,
      targetUserId: userId,
    })
    .returning({ id: playlists.id });
  await db.insert(playlistTracks).values(
    trackIds.map((trackId, i) => ({ playlistId: row.id, trackId, position: i })),
  );
}

/** Удаляет все личные подборки юзера вместе с их треками. */
export async function deletePersonalPlaylists(userId: string): Promise<void> {
  const rows = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(eq(playlists.targetUserId, userId));
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  await db.delete(playlistTracks).where(inArray(playlistTracks.playlistId, ids));
  await db.delete(playlists).where(inArray(playlists.id, ids)); // playlist_likes: onDelete cascade
}

/** Публичные пользовательские плейлисты для секции на главной. */
export async function getPublicUserPlaylists(limit = 8): Promise<EditorialPlaylist[]> {
  const rows = await db
    .select(META)
    .from(playlists)
    .where(and(eq(playlists.visibility, 'PUBLIC'), eq(playlists.kind, 'USER')))
    .orderBy(desc(playlists.likesCount), desc(playlists.updatedAt))
    .limit(limit);
  return hydratePlaylists(rows);
}


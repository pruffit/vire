import { and, asc, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { db } from '../client';
import { playlists, playlistTracks, playlistLikes, tracks, releases, artistProfiles } from '../schema';

export interface PlaylistSummary {
  id: string;
  title: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  trackCount: number;
  coverUrl: string | null;
  updatedAt: Date;
}

export interface PlaylistTrackRow {
  id: string;
  title: string;
  durationSec: number | null;
  position: number;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
}

export interface PlaylistWithTracks {
  id: string;
  title: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  ownerUserId: string | null;
  tracks: PlaylistTrackRow[];
}

export interface EditorialPlaylist {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  trackCount: number;
  likesCount: number;
  covers: string[]; // up to 4 cover URLs for collage
}

export async function getUserPlaylists(userId: string): Promise<PlaylistSummary[]> {
  const rows = await db
    .select({
      id: playlists.id,
      title: playlists.title,
      visibility: playlists.visibility,
      updatedAt: playlists.updatedAt,
    })
    .from(playlists)
    .where(eq(playlists.ownerUserId, userId))
    .orderBy(desc(playlists.updatedAt));

  const withMeta = await Promise.all(
    rows.map(async (p) => {
      const [countRow] = await db
        .select({ c: count() })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, p.id));

      const [firstTrack] = await db
        .select({ coverUrl: releases.coverUrl })
        .from(playlistTracks)
        .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
        .innerJoin(releases, eq(releases.id, tracks.releaseId))
        .where(eq(playlistTracks.playlistId, p.id))
        .orderBy(asc(playlistTracks.position))
        .limit(1);

      return {
        id: p.id,
        title: p.title,
        visibility: p.visibility,
        updatedAt: p.updatedAt,
        trackCount: Number(countRow?.c ?? 0),
        coverUrl: firstTrack?.coverUrl ?? null,
      };
    }),
  );

  return withMeta;
}

export async function getPlaylistWithTracks(
  playlistId: string,
): Promise<PlaylistWithTracks | null> {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(eq(playlists.id, playlistId));

  if (!playlist) return null;

  const trackRows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      durationSec: tracks.durationSec,
      position: playlistTracks.position,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      releaseId: releases.id,
      coverUrl: releases.coverUrl,
    })
    .from(playlistTracks)
    .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(eq(playlistTracks.playlistId, playlistId))
    .orderBy(asc(playlistTracks.position));

  return {
    id: playlist.id,
    title: playlist.title,
    visibility: playlist.visibility,
    ownerUserId: playlist.ownerUserId,
    tracks: trackRows,
  };
}

export async function createPlaylist(userId: string, title: string): Promise<string> {
  const [row] = await db
    .insert(playlists)
    .values({ ownerUserId: userId, title })
    .returning({ id: playlists.id });
  return row.id;
}

export async function deletePlaylist(playlistId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, userId)))
    .returning({ id: playlists.id });
  return result.length > 0;
}

export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({ position: playlistTracks.position })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId))
    .orderBy(desc(playlistTracks.position))
    .limit(1);

  const position = rows.length > 0 ? rows[0].position + 1 : 0;

  await db
    .insert(playlistTracks)
    .values({ playlistId, trackId, position, addedBy: userId });

  await db
    .update(playlists)
    .set({ updatedAt: new Date() })
    .where(eq(playlists.id, playlistId));
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  await db
    .delete(playlistTracks)
    .where(
      and(
        eq(playlistTracks.playlistId, playlistId),
        eq(playlistTracks.trackId, trackId),
      ),
    );

  await db
    .update(playlists)
    .set({ updatedAt: new Date() })
    .where(eq(playlists.id, playlistId));
}

export async function getTrackPlaylistIds(
  userId: string,
  trackId: string,
): Promise<string[]> {
  const userPlaylists = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(eq(playlists.ownerUserId, userId));

  if (userPlaylists.length === 0) return [];

  const ids = userPlaylists.map((p) => p.id);

  const rows = await db
    .select({ playlistId: playlistTracks.playlistId })
    .from(playlistTracks)
    .where(
      and(
        eq(playlistTracks.trackId, trackId),
        inArray(playlistTracks.playlistId, ids),
      ),
    );

  return rows.map((r) => r.playlistId);
}

export async function renamePlaylist(
  playlistId: string,
  userId: string,
  title: string,
): Promise<void> {
  await db
    .update(playlists)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, userId)));
}

// ─── Редакционные и личные подборки ────────────────────────────────────────

interface PlaylistMetaRow {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  likesCount: number;
}

/** Досчитывает trackCount + до 4 обложек (коллаж). Общий хелпер всех геттеров подборок. */
async function hydratePlaylists(rows: PlaylistMetaRow[]): Promise<EditorialPlaylist[]> {
  if (rows.length === 0) return [];
  const playlistIds = rows.map((r) => r.id);

  const trackCountRows = await db
    .select({ playlistId: playlistTracks.playlistId, c: count() })
    .from(playlistTracks)
    .where(inArray(playlistTracks.playlistId, playlistIds))
    .groupBy(playlistTracks.playlistId);

  const countByPlaylist = Object.fromEntries(
    trackCountRows.map((r) => [r.playlistId, Number(r.c)]),
  );

  const coverRows = await db
    .select({
      playlistId: playlistTracks.playlistId,
      coverUrl: releases.coverUrl,
      position: playlistTracks.position,
    })
    .from(playlistTracks)
    .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(
      and(
        inArray(playlistTracks.playlistId, playlistIds),
        sql`${releases.coverUrl} IS NOT NULL`,
      ),
    )
    .orderBy(asc(playlistTracks.position));

  const coversByPlaylist: Record<string, string[]> = {};
  for (const row of coverRows) {
    const list = (coversByPlaylist[row.playlistId] ??= []);
    if (list.length < 4 && row.coverUrl) list.push(row.coverUrl);
  }

  // Сохраняем порядок входных rows (важно для приоритета показа).
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    kind: r.kind,
    trackCount: countByPlaylist[r.id] ?? 0,
    likesCount: r.likesCount,
    covers: coversByPlaylist[r.id] ?? [],
  }));
}

const META = {
  id: playlists.id,
  title: playlists.title,
  description: playlists.description,
  kind: playlists.kind,
  likesCount: playlists.likesCount,
};

// Приоритет показа общих подборок: тренды и свежее впереди, затем настроения,
// «возвращаются снова» — как фолбэк-наполнитель.
const SHARED_PRIORITY = sql`CASE ${playlists.kind}
  WHEN 'TRENDING' THEN 0 WHEN 'FRESH' THEN 1 WHEN 'MOOD' THEN 2 ELSE 3 END`;

/**
 * Общие (одинаковые для всех) редакционные подборки. Без личных
 * (`target_user_id IS NULL`) и без пользовательских (`kind <> 'USER'`).
 */
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

/**
 * Популярные общие подборки — фолбэк для личной половины (гость / новый юзер
 * без сигнала). Исключает уже показанные id.
 */
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

/** Создаёт или обновляет общую редакционную подборку по kind+title (target_user_id IS NULL). */
export async function upsertEditorialPlaylist(opts: {
  kind: 'MOOD' | 'TRENDING' | 'RELISTEN' | 'FRESH';
  title: string;
  description?: string;
  trackIds: string[];
}): Promise<void> {
  const { kind, title, description, trackIds } = opts;

  const existing = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(
      eq(playlists.kind, kind),
      eq(playlists.title, title),
      sql`${playlists.targetUserId} IS NULL`,
    ))
    .limit(1);

  let playlistId: string;
  if (existing.length > 0) {
    playlistId = existing[0].id;
    await db
      .update(playlists)
      .set({ description: description ?? null, updatedAt: new Date() })
      .where(eq(playlists.id, playlistId));
    // Заменяем треки полностью
    await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlistId));
  } else {
    const [row] = await db
      .insert(playlists)
      .values({
        title,
        description: description ?? null,
        kind,
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

/** Создаёт личную подборку (kind=PERSONAL) для юзера. Личные пересобираются целиком,
 *  поэтому это insert, а не upsert — перед партией вызывай deletePersonalPlaylists. */
export async function createPersonalPlaylist(opts: {
  userId: string;
  title: string;
  description?: string;
  trackIds: string[];
}): Promise<void> {
  const { userId, title, description, trackIds } = opts;
  if (trackIds.length === 0) return;
  const [row] = await db
    .insert(playlists)
    .values({
      title,
      description: description ?? null,
      kind: 'PERSONAL',
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
  await db.delete(playlists).where(inArray(playlists.id, ids)); // playlist_likes — onDelete cascade
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

// ─── Лайки плейлистов ──────────────────────────────────────────────────────

export async function getPlaylistLikeState(
  userId: string,
  playlistId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: playlistLikes.id })
    .from(playlistLikes)
    .where(
      and(eq(playlistLikes.userId, userId), eq(playlistLikes.playlistId, playlistId)),
    )
    .limit(1);
  return rows.length > 0;
}

export async function likePlaylist(userId: string, playlistId: string): Promise<void> {
  await db
    .insert(playlistLikes)
    .values({ userId, playlistId })
    .onConflictDoNothing();
  await db
    .update(playlists)
    .set({ likesCount: sql`${playlists.likesCount} + 1` })
    .where(eq(playlists.id, playlistId));
}

export async function unlikePlaylist(userId: string, playlistId: string): Promise<void> {
  const result = await db
    .delete(playlistLikes)
    .where(
      and(eq(playlistLikes.userId, userId), eq(playlistLikes.playlistId, playlistId)),
    )
    .returning({ id: playlistLikes.id });
  if (result.length > 0) {
    await db
      .update(playlists)
      .set({ likesCount: sql`GREATEST(${playlists.likesCount} - 1, 0)` })
      .where(eq(playlists.id, playlistId));
  }
}

/** Возвращает id редакционных плейлистов, лайкнутых пользователем. */
export async function getLikedPlaylistIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ playlistId: playlistLikes.playlistId })
    .from(playlistLikes)
    .where(eq(playlistLikes.userId, userId));
  return rows.map((r) => r.playlistId);
}

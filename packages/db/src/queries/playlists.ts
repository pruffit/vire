import { and, asc, count, desc, eq, ilike, inArray, notInArray, sql } from 'drizzle-orm';
import { db } from '../client';
import { playlists, playlistTracks, playlistLikes, tracks, releases, artistProfiles, likes, playEvents } from '../schema';
import { featFromCredits } from './track-credits';

export interface PlaylistSummary {
  id: string;
  title: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  trackCount: number;
  coverUrl: string | null;
  covers: string[];
  createdAt: Date;
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
  accentColor: string | null;
  isExplicit: boolean;
  version: string | null;
  feat: string[];
}

export interface PlaylistWithTracks {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  visibility: 'PRIVATE' | 'PUBLIC';
  ownerUserId: string | null;
  likesCount: number;
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

export interface PlaylistAddTrack {
  id: string;
  title: string;
  durationSec: number | null;
  releaseId: string;
  artistName: string;
  artistSlug: string;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean;
  version: string | null;
  feat: string[];
}

export interface PlaylistSuggestions {
  liked: PlaylistAddTrack[];
  recent: PlaylistAddTrack[];
  similar: PlaylistAddTrack[];
}

export async function getUserPlaylists(userId: string): Promise<PlaylistSummary[]> {
  const rows = await db
    .select({
      id: playlists.id,
      title: playlists.title,
      visibility: playlists.visibility,
      createdAt: playlists.createdAt,
      updatedAt: playlists.updatedAt,
      coverUrl: playlists.coverUrl,
    })
    .from(playlists)
    .where(eq(playlists.ownerUserId, userId))
    .orderBy(desc(playlists.updatedAt));

  const meta = await fetchPlaylistMeta(rows.map((r) => r.id));

  return rows.map((p) => {
    const m = meta.get(p.id);
    const covers = pickCovers(p.coverUrl, m?.covers ?? []);
    return {
      id: p.id,
      title: p.title,
      visibility: p.visibility,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      trackCount: m?.trackCount ?? 0,
      coverUrl: covers[0] ?? null,
      covers,
    };
  });
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
      accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
      isExplicit: tracks.isExplicit,
      version: tracks.version,
      credits: tracks.credits,
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
    description: playlist.description,
    coverUrl: playlist.coverUrl,
    visibility: playlist.visibility,
    ownerUserId: playlist.ownerUserId,
    likesCount: playlist.likesCount,
    tracks: trackRows.map(({ credits, ...r }) => ({ ...r, feat: featFromCredits(credits) })),
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
    .values({ playlistId, trackId, position, addedBy: userId })
    .onConflictDoNothing();

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

export function isPermutation(proposed: string[], current: string[]): boolean {
  if (proposed.length !== current.length) return false;
  const set = new Set(current);
  return proposed.every((id) => set.has(id));
}

export async function reorderPlaylistTracks(
  playlistId: string,
  userId: string,
  orderedTrackIds: string[],
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [pl] = await tx
      .select({ ownerUserId: playlists.ownerUserId })
      .from(playlists)
      .where(eq(playlists.id, playlistId));
    if (!pl || pl.ownerUserId !== userId) return false;

    const current = await tx
      .select({ trackId: playlistTracks.trackId })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId));

    if (!isPermutation(orderedTrackIds, current.map((r) => r.trackId))) return false;

    for (let i = 0; i < orderedTrackIds.length; i++) {
      await tx
        .update(playlistTracks)
        .set({ position: i })
        .where(
          and(
            eq(playlistTracks.playlistId, playlistId),
            eq(playlistTracks.trackId, orderedTrackIds[i]!),
          ),
        );
    }
    await tx
      .update(playlists)
      .set({ updatedAt: new Date() })
      .where(eq(playlists.id, playlistId));
    return true;
  });
}

export async function updatePlaylist(
  playlistId: string,
  userId: string,
  patch: { title?: string; description?: string | null; visibility?: 'PRIVATE' | 'PUBLIC' },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.visibility !== undefined) set.visibility = patch.visibility;
  await db
    .update(playlists)
    .set(set)
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, userId)));
}

export async function setPlaylistCover(
  playlistId: string,
  userId: string,
  coverUrl: string | null,
): Promise<void> {
  await db
    .update(playlists)
    .set({ coverUrl, updatedAt: new Date() })
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, userId)));
}

export async function renamePlaylist(
  playlistId: string,
  userId: string,
  title: string,
): Promise<void> {
  await updatePlaylist(playlistId, userId, { title });
}

// ─── Редакционные и личные подборки ────────────────────────────────────────

interface PlaylistMetaRow {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  likesCount: number;
  coverUrl: string | null;
}

export interface PlaylistMeta {
  trackCount: number;
  covers: string[];
}

/** Дедуп обложек треков, своя обложка плейлиста первой, максимум 4. */
export function pickCovers(
  playlistCoverUrl: string | null,
  trackCovers: (string | null)[],
): string[] {
  const unique: string[] = [];
  for (let i = 0; i < trackCovers.length && unique.length < 4; i++) {
    const c = trackCovers[i];
    if (c && !unique.includes(c)) unique.push(c);
  }
  if (!playlistCoverUrl) return unique.slice(0, 4);
  return [playlistCoverUrl, ...unique.filter((c) => c !== playlistCoverUrl)].slice(0, 4);
}

/** Batch trackCount + до 4 обложек треков (без своей обложки плейлиста) на все id сразу. */
export async function fetchPlaylistMeta(playlistIds: string[]): Promise<Map<string, PlaylistMeta>> {
  const result = new Map<string, PlaylistMeta>();
  if (playlistIds.length === 0) return result;

  const trackCountRows = await db
    .select({ playlistId: playlistTracks.playlistId, c: count() })
    .from(playlistTracks)
    .where(inArray(playlistTracks.playlistId, playlistIds))
    .groupBy(playlistTracks.playlistId);

  const countByPlaylist = new Map(trackCountRows.map((r) => [r.playlistId, Number(r.c)]));

  const coverRows = await db
    .select({
      playlistId: playlistTracks.playlistId,
      coverUrl: releases.coverUrl,
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

  const coversByPlaylist = new Map<string, string[]>();
  for (const row of coverRows) {
    if (!row.coverUrl) continue;
    const list = coversByPlaylist.get(row.playlistId) ?? [];
    if (list.length < 4 && !list.includes(row.coverUrl)) list.push(row.coverUrl);
    coversByPlaylist.set(row.playlistId, list);
  }

  for (const id of playlistIds) {
    result.set(id, {
      trackCount: countByPlaylist.get(id) ?? 0,
      covers: coversByPlaylist.get(id) ?? [],
    });
  }
  return result;
}

/** Досчитывает trackCount + до 4 обложек (коллаж). Общий хелпер всех геттеров подборок. */
async function hydratePlaylists(rows: PlaylistMetaRow[]): Promise<EditorialPlaylist[]> {
  if (rows.length === 0) return [];
  const meta = await fetchPlaylistMeta(rows.map((r) => r.id));

  // Сохраняем порядок входных rows (важно для приоритета показа).
  return rows.map((r) => {
    const m = meta.get(r.id);
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      kind: r.kind,
      trackCount: m?.trackCount ?? 0,
      likesCount: r.likesCount,
      covers: pickCovers(r.coverUrl, m?.covers ?? []),
    };
  });
}

const META = {
  id: playlists.id,
  title: playlists.title,
  description: playlists.description,
  kind: playlists.kind,
  likesCount: playlists.likesCount,
  coverUrl: playlists.coverUrl,
};

// Приоритет показа общих подборок: тренды и свежее впереди, затем настроения,
// «возвращаются снова» как фолбэк-наполнитель.
const SHARED_PRIORITY = sql`CASE ${playlists.kind}
  WHEN 'TRENDING' THEN 0 WHEN 'FRESH' THEN 1 WHEN 'MOOD' THEN 2 ELSE 3 END`;

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

/** Создаёт личную подборку (kind=PERSONAL). Личные пересобираются целиком: это insert,
 *  не upsert, перед партией вызывай deletePersonalPlaylists. */
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

/** Плейлисты, лайкнутые пользователем (публичные: ставший приватным лайкнутый плейлист скрывается). */
export async function getLikedPlaylists(userId: string): Promise<EditorialPlaylist[]> {
  const rows = await db
    .select(META)
    .from(playlistLikes)
    .innerJoin(playlists, eq(playlists.id, playlistLikes.playlistId))
    .where(and(eq(playlistLikes.userId, userId), eq(playlists.visibility, 'PUBLIC')))
    .orderBy(desc(playlistLikes.createdAt));
  return hydratePlaylists(rows);
}

/** Возвращает id редакционных плейлистов, лайкнутых пользователем. */
export async function getLikedPlaylistIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ playlistId: playlistLikes.playlistId })
    .from(playlistLikes)
    .where(eq(playlistLikes.userId, userId));
  return rows.map((r) => r.playlistId);
}

// ─── Поиск треков + умные подсказки ────────────────────────────────────────

export async function searchTracksForPlaylist(
  q: string,
  excludeTrackIds: string[],
  limit = 20,
): Promise<PlaylistAddTrack[]> {
  if (!q.trim()) return [];
  const like = `%${q.trim()}%`;
  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      durationSec: tracks.durationSec,
      releaseId: releases.id,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      coverUrl: releases.coverUrl,
      accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
      isExplicit: tracks.isExplicit,
      version: tracks.version,
      credits: tracks.credits,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(tracks.status, 'READY'),
        ilike(tracks.title, like),
        excludeTrackIds.length > 0 ? notInArray(tracks.id, excludeTrackIds) : sql`true`,
      ),
    )
    .limit(limit);
  return rows.map(({ credits, ...r }) => ({ ...r, feat: featFromCredits(credits) }));
}

export async function getPlaylistSuggestions(
  playlistId: string,
  userId: string,
  perSection = 8,
): Promise<PlaylistSuggestions> {
  const inPlaylist = await db
    .select({ trackId: playlistTracks.trackId })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId));
  const exclude = new Set(inPlaylist.map((r) => r.trackId));

  const cols = {
    id: tracks.id,
    title: tracks.title,
    durationSec: tracks.durationSec,
    releaseId: releases.id,
    artistName: artistProfiles.name,
    artistSlug: artistProfiles.slug,
    coverUrl: releases.coverUrl,
    accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
    isExplicit: tracks.isExplicit,
    version: tracks.version,
    credits: tracks.credits,
  };

  const likedRows = await db
    .select({ ...cols, likedAt: likes.createdAt })
    .from(likes)
    .innerJoin(tracks, eq(tracks.id, likes.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(eq(likes.userId, userId), eq(tracks.status, 'READY')))
    .orderBy(desc(likes.createdAt))
    .limit(perSection + exclude.size);

  // dedup происходит в take() ниже
  const recentRows = await db
    .select({ ...cols, startedAt: playEvents.startedAt })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(eq(playEvents.userId, userId), eq(tracks.status, 'READY')))
    .orderBy(desc(playEvents.startedAt))
    .limit((perSection + exclude.size) * 4);

  const artistIdRows = await db
    .selectDistinct({ artistProfileId: releases.artistProfileId })
    .from(playlistTracks)
    .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(eq(playlistTracks.playlistId, playlistId));
  const artistIds = artistIdRows.map((r) => r.artistProfileId);

  const similarRows = artistIds.length
    ? await db
        .select(cols)
        .from(tracks)
        .innerJoin(releases, eq(releases.id, tracks.releaseId))
        .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
        .where(and(eq(tracks.status, 'READY'), inArray(releases.artistProfileId, artistIds)))
        .limit(perSection + exclude.size)
    : [];

  type SuggestionRow = Omit<PlaylistAddTrack, 'feat'> & { credits: unknown };

  const take = (rows: SuggestionRow[], used: Set<string>): PlaylistAddTrack[] => {
    const out: PlaylistAddTrack[] = [];
    for (const r of rows) {
      if (exclude.has(r.id) || used.has(r.id)) continue;
      used.add(r.id);
      out.push({
        id: r.id, title: r.title, durationSec: r.durationSec,
        releaseId: r.releaseId, artistName: r.artistName,
        artistSlug: r.artistSlug, coverUrl: r.coverUrl,
        accentColor: r.accentColor, isExplicit: r.isExplicit,
        version: r.version, feat: featFromCredits(r.credits),
      });
      if (out.length >= perSection) break;
    }
    return out;
  };

  const used = new Set<string>();
  return {
    liked: take(likedRows, used),
    recent: take(recentRows, used),
    similar: take(similarRows as SuggestionRow[], used),
  };
}

import { and, asc, count, desc, eq, ilike, inArray, notInArray, sql, type SQL } from 'drizzle-orm';
import { isUuid } from '@vire/core';
import { db } from '../client';
import { playlists, playlistTracks, playlistLikes, playlistCollaborators, tracks, releases, artistProfiles, likes, playEvents, users } from '../schema';
import type { EditorialParams } from '../schema';
import { featFromCredits } from './track-credits';
import { fetchPlaylistMeta, hydratePlaylists, META, pickCovers, type EditorialPlaylist } from './playlist-meta';

export interface PlaylistSummary {
  id: string;
  title: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  trackCount: number;
  coverUrl: string | null;
  covers: string[];
  createdAt: Date;
  updatedAt: Date;
  role?: 'OWNER' | 'COLLABORATOR';
}

export interface PlaylistTrackAddedByRow {
  id: string;
  name: string | null;
  image: string | null;
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
  addedBy: PlaylistTrackAddedByRow | null;
}

export interface PlaylistWithTracks {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  kind: string;
  editorialParams: EditorialParams | null;
  visibility: 'PRIVATE' | 'PUBLIC';
  ownerUserId: string | null;
  likesCount: number;
  isCollaborative: boolean;
  version: number;
  tracks: PlaylistTrackRow[];
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

const OWN_PLAYLIST_COLS = {
  id: playlists.id,
  title: playlists.title,
  visibility: playlists.visibility,
  createdAt: playlists.createdAt,
  updatedAt: playlists.updatedAt,
  coverUrl: playlists.coverUrl,
};

export async function getUserPlaylists(userId: string): Promise<PlaylistSummary[]> {
  const ownRows = await db
    .select(OWN_PLAYLIST_COLS)
    .from(playlists)
    .where(eq(playlists.ownerUserId, userId))
    .orderBy(desc(playlists.updatedAt));

  const collabRows = await db
    .select(OWN_PLAYLIST_COLS)
    .from(playlistCollaborators)
    .innerJoin(playlists, eq(playlists.id, playlistCollaborators.playlistId))
    .where(eq(playlistCollaborators.userId, userId))
    .orderBy(desc(playlists.updatedAt));

  const rows = [
    ...ownRows.map((r) => ({ ...r, role: 'OWNER' as const })),
    ...collabRows.map((r) => ({ ...r, role: 'COLLABORATOR' as const })),
  ];

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
      role: p.role,
    };
  });
}

export async function getPublicPlaylistsByOwner(ownerUserId: string): Promise<PlaylistSummary[]> {
  const rows = await db
    .select({
      id: playlists.id,
      title: playlists.title,
      visibility: playlists.visibility,
      coverUrl: playlists.coverUrl,
      createdAt: playlists.createdAt,
      updatedAt: playlists.updatedAt,
    })
    .from(playlists)
    .where(and(eq(playlists.ownerUserId, ownerUserId), eq(playlists.visibility, 'PUBLIC'), eq(playlists.kind, 'USER')))
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
  // без гейта нецелой строкой Postgres кидает invalid input syntax for type uuid → 500 вместо 404
  if (!isUuid(playlistId)) return null;

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
      addedById: users.id,
      addedByName: users.name,
      addedByImage: users.image,
    })
    .from(playlistTracks)
    .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .leftJoin(users, eq(users.id, playlistTracks.addedBy))
    .where(eq(playlistTracks.playlistId, playlistId))
    .orderBy(asc(playlistTracks.position));

  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    coverUrl: playlist.coverUrl,
    kind: playlist.kind,
    editorialParams: playlist.editorialParams,
    visibility: playlist.visibility,
    ownerUserId: playlist.ownerUserId,
    likesCount: playlist.likesCount,
    isCollaborative: playlist.isCollaborative,
    version: playlist.version,
    tracks: trackRows.map(({ credits, addedById, addedByName, addedByImage, ...r }) => ({
      ...r,
      feat: featFromCredits(credits),
      addedBy: addedById ? { id: addedById, name: addedByName, image: addedByImage } : null,
    })),
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
): Promise<number | null> {
  return db.transaction(async (tx) => {
    // Лочит строку плейлиста до конца транзакции — сериализует состав/вступление на плейлист.
    await tx.select({ id: playlists.id }).from(playlists).where(eq(playlists.id, playlistId)).for('update');

    const rows = await tx
      .select({ position: playlistTracks.position })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(desc(playlistTracks.position))
      .limit(1);

    const position = rows.length > 0 ? rows[0].position + 1 : 0;

    const inserted = await tx
      .insert(playlistTracks)
      .values({ playlistId, trackId, position, addedBy: userId })
      .onConflictDoNothing()
      .returning({ id: playlistTracks.id });
    if (inserted.length === 0) return null; // трек уже был в плейлисте — no-op

    const [row] = await tx
      .update(playlists)
      .set({ updatedAt: new Date(), version: sql`${playlists.version} + 1` })
      .where(eq(playlists.id, playlistId))
      .returning({ version: playlists.version });
    return row?.version ?? 0;
  });
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<number | null> {
  return db.transaction(async (tx) => {
    await tx.select({ id: playlists.id }).from(playlists).where(eq(playlists.id, playlistId)).for('update');

    const deleted = await tx
      .delete(playlistTracks)
      .where(
        and(
          eq(playlistTracks.playlistId, playlistId),
          eq(playlistTracks.trackId, trackId),
        ),
      )
      .returning({ id: playlistTracks.id });
    if (deleted.length === 0) return null; // трека и не было — no-op

    const [row] = await tx
      .update(playlists)
      .set({ updatedAt: new Date(), version: sql`${playlists.version} + 1` })
      .where(eq(playlists.id, playlistId))
      .returning({ version: playlists.version });
    return row?.version ?? 0;
  });
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

// userId остаётся в сигнатуре ради стабильного контракта репозитория — авторизацию
// (владелец/коллаборатор) проверяет сервис (PlaylistService.canEdit), не запрос.
export async function reorderPlaylistTracks(
  playlistId: string,
  userId: string,
  orderedTrackIds: string[],
): Promise<number | null> {
  return db.transaction(async (tx) => {
    await tx.select({ id: playlists.id }).from(playlists).where(eq(playlists.id, playlistId)).for('update');

    const current = await tx
      .select({ trackId: playlistTracks.trackId })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId));

    if (!isPermutation(orderedTrackIds, current.map((r) => r.trackId))) return null;

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
    const [row] = await tx
      .update(playlists)
      .set({ updatedAt: new Date(), version: sql`${playlists.version} + 1` })
      .where(eq(playlists.id, playlistId))
      .returning({ version: playlists.version });
    return row?.version ?? 0;
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

export interface SitemapPlaylist {
  id: string;
  updatedAt: Date;
}

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

export async function getLikedPlaylistIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ playlistId: playlistLikes.playlistId })
    .from(playlistLikes)
    .where(eq(playlistLikes.userId, userId));
  return rows.map((r) => r.playlistId);
}

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

import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { playlists, playlistTracks, tracks, releases, artistProfiles } from '../schema';

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
  ownerUserId: string;
  tracks: PlaylistTrackRow[];
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

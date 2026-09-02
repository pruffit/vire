import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { users, artistProfiles, releases, tracks, trackAudio, playEvents, likes, playlists, playlistTracks, artistPosts } from '../schema';

// Каталог в бэкофисе: треки, релизы, посты и плейлисты — просмотр со счётчиками
// и смена статуса. Артисты вынесены отдельно (admin-artists.ts).

export interface AdminPost {
  id: string;
  title: string | null;
  body: string;
  artistName: string;
  artistSlug: string;
  createdAt: Date;
}

export async function listPostsAdmin(limit = 100): Promise<AdminPost[]> {
  const rows = await db
    .select({
      id: artistPosts.id,
      title: artistPosts.title,
      body: artistPosts.body,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      createdAt: artistPosts.createdAt,
    })
    .from(artistPosts)
    .innerJoin(artistProfiles, eq(artistProfiles.id, artistPosts.artistProfileId))
    .orderBy(desc(artistPosts.createdAt))
    .limit(limit);
  return rows;
}

export interface AdminPlaylist {
  id: string;
  title: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  kind: string;
  isCurated: boolean;
  ownerEmail: string | null;
  trackCount: number;
  likesCount: number;
  createdAt: Date;
}

export async function listPlaylistsAdmin(limit = 100): Promise<AdminPlaylist[]> {
  const rows = await db
    .select({
      id: playlists.id,
      title: playlists.title,
      visibility: playlists.visibility,
      kind: playlists.kind,
      isCurated: playlists.isCurated,
      ownerEmail: users.email,
      likesCount: playlists.likesCount,
      createdAt: playlists.createdAt,
      trackCount: sql<number>`(select count(*) from playlist_tracks pt where pt.playlist_id = playlists.id)`,
    })
    .from(playlists)
    .leftJoin(users, eq(users.id, playlists.ownerUserId))
    .orderBy(desc(playlists.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, trackCount: Number(r.trackCount) }));
}

export async function adminUpdatePlaylist(
  id: string,
  data: { title: string; visibility: 'PRIVATE' | 'PUBLIC' },
): Promise<void> {
  await db
    .update(playlists)
    .set({ title: data.title, visibility: data.visibility })
    .where(eq(playlists.id, id));
}

/** Удаление плейлиста админом. playlist_tracks не каскадит, чистим в транзакции;
 *  playlist_likes удалятся каскадом по FK. */
export async function adminDeletePlaylist(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(playlistTracks).where(eq(playlistTracks.playlistId, id));
    await tx.delete(playlists).where(eq(playlists.id, id));
  });
}


export interface AdminTrack {
  id: string;
  title: string;
  status: string;
  trackNumber: number;
  createdAt: Date;
  releaseTitle: string;
  releaseId: string;
  artistName: string;
  artistSlug: string;
  durationSec: number | null;
  bpm: number | null;
  musicalKey: string | null;
  hasHls: boolean;
  playsTotal: number;
  likesCount: number;
}

export async function listTracksAdmin(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminTrack[]> {
  const { status, limit = 50, offset = 0 } = opts;

  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      status: tracks.status,
      trackNumber: tracks.trackNumber,
      createdAt: tracks.createdAt,
      releaseTitle: releases.title,
      releaseId: releases.id,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      durationSec: tracks.durationSec,
      bpm: trackAudio.bpm,
      musicalKey: trackAudio.musicalKey,
      hasHls: sql<boolean>`${trackAudio.hlsManifestKey} is not null`,
      playsTotal: sql<number>`(select count(*) from play_events pe where pe.track_id = tracks.id)::int`,
      likesCount: sql<number>`(select count(*) from likes l where l.track_id = tracks.id)::int`,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .leftJoin(trackAudio, eq(trackAudio.trackId, tracks.id))
    .where(status ? eq(tracks.status, status as 'PROCESSING' | 'READY' | 'BLOCKED') : undefined)
    .orderBy(desc(tracks.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    hasHls: Boolean(r.hasHls),
    playsTotal: Number(r.playsTotal),
    likesCount: Number(r.likesCount),
  }));
}

export async function setTrackStatus(
  trackId: string,
  status: 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED',
): Promise<void> {
  await db.update(tracks).set({ status, updatedAt: new Date() }).where(eq(tracks.id, trackId));
}

export interface AdminRelease {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: Date;
  releaseDate: Date | null;
  artistName: string;
  artistSlug: string;
  trackCount: number;
}

export async function listReleasesAdmin(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminRelease[]> {
  const { status, limit = 50, offset = 0 } = opts;

  const rows = await db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      status: releases.status,
      createdAt: releases.createdAt,
      releaseDate: releases.releaseDate,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      trackCount: count(tracks.id),
    })
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .leftJoin(tracks, eq(tracks.releaseId, releases.id))
    .where(
      status
        ? eq(releases.status, status as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED')
        : undefined,
    )
    .groupBy(releases.id, artistProfiles.name, artistProfiles.slug)
    .orderBy(desc(releases.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({ ...r, trackCount: Number(r.trackCount) }));
}

export async function setReleaseStatus(
  releaseId: string,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
): Promise<void> {
  await db.update(releases).set({ status, updatedAt: new Date() }).where(eq(releases.id, releaseId));
}


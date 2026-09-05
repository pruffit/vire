import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../client';
import { playlists, playlistTracks, playlistLikes, tracks, releases } from '../schema';
import type { EditorialParams } from '../schema';

// Общие строительные блоки подборок: коллаж обложек и досчёт трек-каунта.
// Нужны и пользовательским плейлистам, и редакционным — потому вынесены сюда,
// а не в одну из сторон.

export interface EditorialPlaylist {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  editorialParams: EditorialParams | null;
  trackCount: number;
  likesCount: number;
  covers: string[]; // up to 4 cover URLs for collage
}


interface PlaylistMetaRow {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  editorialParams: EditorialParams | null;
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
export async function hydratePlaylists(rows: PlaylistMetaRow[]): Promise<EditorialPlaylist[]> {
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
      editorialParams: r.editorialParams,
      trackCount: m?.trackCount ?? 0,
      likesCount: r.likesCount,
      covers: pickCovers(r.coverUrl, m?.covers ?? []),
    };
  });
}

export const META = {
  id: playlists.id,
  title: playlists.title,
  description: playlists.description,
  kind: playlists.kind,
  editorialParams: playlists.editorialParams,
  likesCount: playlists.likesCount,
  coverUrl: playlists.coverUrl,
};

// Приоритет показа общих подборок: тренды и свежее впереди, затем настроения,
// «возвращаются снова» как фолбэк-наполнитель.
export const SHARED_PRIORITY = sql`CASE ${playlists.kind}
  WHEN 'TRENDING' THEN 0 WHEN 'FRESH' THEN 1 WHEN 'MOOD' THEN 2 ELSE 3 END`;


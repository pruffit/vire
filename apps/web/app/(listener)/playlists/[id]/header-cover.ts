import { pickCovers } from '@vire/db';

/** Обложки шапки плейлиста: своя обложка + обложки треков (дедуп, ≤4, через pickCovers). */
export function getHeaderCovers(playlist: {
  coverUrl: string | null;
  tracks: { coverUrl: string | null }[];
}): string[] {
  return pickCovers(playlist.coverUrl, playlist.tracks.map((t) => t.coverUrl));
}

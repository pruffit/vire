import { eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { trackGenres, type genreEnum } from '../schema';

export type TrackGenre = typeof genreEnum.enumValues[number];

export const ALL_TRACK_GENRES: TrackGenre[] = [
  'ELECTRONIC', 'HIPHOP', 'ROCK', 'INDIE', 'POP', 'AMBIENT', 'JAZZ',
  'CLASSICAL', 'METAL', 'FOLK', 'RNB', 'TECHNO', 'EXPERIMENTAL', 'LOFI',
];

export const TRACK_GENRE_LABELS: Record<TrackGenre, string> = {
  ELECTRONIC: 'Электроника',
  HIPHOP: 'Хип-хоп',
  ROCK: 'Рок',
  INDIE: 'Инди',
  POP: 'Поп',
  AMBIENT: 'Эмбиент',
  JAZZ: 'Джаз',
  CLASSICAL: 'Классика',
  METAL: 'Метал',
  FOLK: 'Фолк',
  RNB: 'R&B',
  TECHNO: 'Техно',
  EXPERIMENTAL: 'Экспериментальное',
  LOFI: 'Lo-fi',
};

export async function getTrackGenres(trackId: string): Promise<TrackGenre[]> {
  const rows = await db
    .select({ genre: trackGenres.genre })
    .from(trackGenres)
    .where(eq(trackGenres.trackId, trackId));
  return rows.map((r) => r.genre);
}

export async function setTrackGenres(trackId: string, genres: TrackGenre[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(trackGenres).where(eq(trackGenres.trackId, trackId));
    if (genres.length > 0) {
      await tx.insert(trackGenres).values(genres.map((genre) => ({ trackId, genre })));
    }
  });
}

export async function getGenresForTracks(trackIds: string[]): Promise<Record<string, TrackGenre[]>> {
  if (trackIds.length === 0) return {};
  const rows = await db
    .select()
    .from(trackGenres)
    .where(inArray(trackGenres.trackId, trackIds));
  const result: Record<string, TrackGenre[]> = {};
  for (const row of rows) {
    if (!result[row.trackId]) result[row.trackId] = [];
    result[row.trackId].push(row.genre);
  }
  return result;
}

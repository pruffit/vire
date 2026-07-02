import { and, eq, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { trackGenres, genreEnum, tracks, releases, artistProfiles } from '../schema';

export type TrackGenre = typeof genreEnum.enumValues[number];

// Источник правды — сам enum: список не дублируем, чтобы не расходился со схемой.
// Человеко-читаемые подписи живут в apps/web/lib/genres.ts (клиентский слой).
export const ALL_TRACK_GENRES: TrackGenre[] = [...genreEnum.enumValues];

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

export interface GenreCount {
  genre: TrackGenre;
  count: number;
}

/** Зеркало getMoodCounts: счётчик по жанрам только READY-треков вышедших релизов активных артистов. */
export async function getGenreCounts(): Promise<GenreCount[]> {
  return db
    .select({ genre: trackGenres.genre, count: sql<number>`count(*)::int` })
    .from(trackGenres)
    .innerJoin(tracks, eq(tracks.id, trackGenres.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(tracks.status, 'READY'),
        eq(artistProfiles.isActive, true),
        or(
          eq(releases.status, 'PUBLISHED'),
          and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
        ),
      ),
    )
    .groupBy(trackGenres.genre)
    .orderBy(sql`count(*) DESC`);
}

import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { likes, playEvents, trackMoods, trackGenres, tracks, releases, artistProfiles } from '../schema';
import type { Mood } from './track-moods';
import type { TrackGenre } from './track-genres';

export interface TasteProfile {
  topMoods: Mood[];
  topGenres: TrackGenre[];
  topArtistIds: string[];
}

// Свежий подзапрос под каждый вызов — один и тот же query builder нельзя
// переиспользовать в трёх параллельных внешних запросах ниже.
function likedTrackIds(userId: string) {
  return db.select({ trackId: likes.trackId }).from(likes).where(eq(likes.userId, userId));
}

function recentlyPlayedTrackIds(userId: string) {
  return db
    .select({ trackId: playEvents.trackId })
    .from(playEvents)
    .where(and(eq(playEvents.userId, userId), sql`${playEvents.startedAt} >= now() - interval '90 days'`));
}

/**
 * Профиль вкуса слушателя: лайки ∪ прослушивания за 90 дней, топ-5 в каждой
 * категории (настроения/жанры/артисты). Пусто = нет сигнала (новый юзер).
 */
export async function getTasteProfile(userId: string): Promise<TasteProfile> {
  const [moodRows, genreRows, artistRows] = await Promise.all([
    db
      .select({ mood: trackMoods.mood, count: sql<number>`count(*)::int` })
      .from(trackMoods)
      .where(
        or(
          inArray(trackMoods.trackId, likedTrackIds(userId)),
          inArray(trackMoods.trackId, recentlyPlayedTrackIds(userId)),
        ),
      )
      .groupBy(trackMoods.mood)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
    db
      .select({ genre: trackGenres.genre, count: sql<number>`count(*)::int` })
      .from(trackGenres)
      .where(
        or(
          inArray(trackGenres.trackId, likedTrackIds(userId)),
          inArray(trackGenres.trackId, recentlyPlayedTrackIds(userId)),
        ),
      )
      .groupBy(trackGenres.genre)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
    db
      .select({ artistId: artistProfiles.id, count: sql<number>`count(*)::int` })
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(
        or(
          inArray(tracks.id, likedTrackIds(userId)),
          inArray(tracks.id, recentlyPlayedTrackIds(userId)),
        ),
      )
      .groupBy(artistProfiles.id)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
  ]);

  return {
    topMoods: moodRows.map((r) => r.mood),
    topGenres: genreRows.map((r) => r.genre),
    topArtistIds: artistRows.map((r) => r.artistId),
  };
}

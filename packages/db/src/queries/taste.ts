import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { createTtlCache } from '@vire/core';
import { db } from '../client';
import { likes, playEvents, trackMoods, trackGenres, tracks, releases, artistProfiles, tasteProfiles } from '../schema';
import { ALL_MOODS, type Mood } from './track-moods';
import { ALL_TRACK_GENRES, type TrackGenre } from './track-genres';

export interface TasteProfile {
  topMoods: Mood[];
  topGenres: TrackGenre[];
  topArtistIds: string[];
}

const tasteProfileCache = createTtlCache<string, TasteProfile>({ ttlMs: 60_000, maxSize: 500 });

export function clearTasteProfileCache(): void {
  tasteProfileCache.clear();
}

// Новый подзапрос на каждый вызов: один query builder нельзя переиспользовать
// в трёх параллельных запросах ниже.
function likedTrackIds(userId: string) {
  return db.select({ trackId: likes.trackId }).from(likes).where(eq(likes.userId, userId));
}

function recentlyPlayedTrackIds(userId: string) {
  return db
    .select({ trackId: playEvents.trackId })
    .from(playEvents)
    .where(and(eq(playEvents.userId, userId), sql`${playEvents.startedAt} >= now() - interval '90 days'`));
}

const MOOD_SET = new Set<string>(ALL_MOODS);
const GENRE_SET = new Set<string>(ALL_TRACK_GENRES);

function toStoredProfile(row: { topMoods: string[]; topGenres: string[]; topArtistIds: string[] }): TasteProfile {
  return {
    topMoods: row.topMoods.filter((m): m is Mood => MOOD_SET.has(m)),
    topGenres: row.topGenres.filter((g): g is TrackGenre => GENRE_SET.has(g)),
    topArtistIds: row.topArtistIds,
  };
}

async function readStoredTasteProfile(userId: string): Promise<TasteProfile | null> {
  const [row] = await db
    .select({
      topMoods: tasteProfiles.topMoods,
      topGenres: tasteProfiles.topGenres,
      topArtistIds: tasteProfiles.topArtistIds,
    })
    .from(tasteProfiles)
    .where(eq(tasteProfiles.userId, userId))
    .limit(1);
  return row ? toStoredProfile(row) : null;
}

async function upsertTasteProfile(userId: string, profile: TasteProfile): Promise<void> {
  await db
    .insert(tasteProfiles)
    .values({
      userId,
      topMoods: profile.topMoods,
      topGenres: profile.topGenres,
      topArtistIds: profile.topArtistIds,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tasteProfiles.userId,
      set: {
        topMoods: profile.topMoods,
        topGenres: profile.topGenres,
        topArtistIds: profile.topArtistIds,
        computedAt: new Date(),
      },
    });
}

export async function materializeTasteProfiles(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    try {
      const fresh = await fetchTasteProfile(userId);
      await upsertTasteProfile(userId, fresh);
    } catch (e) {
      console.error(`taste materialize failed for ${userId}`, e);
    }
  }
}

export function getTasteProfile(userId: string): Promise<TasteProfile> {
  return tasteProfileCache.get(userId, async () => {
    const stored = await readStoredTasteProfile(userId);
    if (stored) return stored;
    const fresh = await fetchTasteProfile(userId);
    await upsertTasteProfile(userId, fresh);
    return fresh;
  });
}

async function fetchTasteProfile(userId: string): Promise<TasteProfile> {
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

import { and, eq, ne, inArray, notInArray, sql, isNotNull, or, lte } from 'drizzle-orm';
import { db } from '../client';
import { trackMoods, trackAudio, tracks, releases, artistProfiles } from '../schema';
import type { Mood } from './track-moods';

export interface WaveTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
}

/**
 * Волна ступень 1: находит следующий трек на основе тегов настроения + BPM + тональность.
 * Взвешенный SQL-запрос без ML.
 *
 * @param currentTrackId — текущий трек; null = seed-режим (случайный стартовый трек)
 * @param playedIds — уже сыгранные в сессии (не повторяем)
 * @param limit — сколько кандидатов вернуть
 * @param seedMood — только для seed-режима: стартовать с трека с этим тегом настроения
 */
export async function getWaveNextTrack(
  currentTrackId: string | null,
  playedIds: string[] = [],
  limit = 1,
  seedMood: Mood | null = null,
): Promise<WaveTrack | null> {
  // Seed-режим: нет текущего трека — возвращаем случайный опубликованный трек
  if (!currentTrackId) {
    const excludeIds = playedIds.filter(Boolean);
    const q = db
      .select({
        id: tracks.id,
        title: tracks.title,
        artistName: artistProfiles.name,
        artistSlug: artistProfiles.slug,
        releaseId: releases.id,
        coverUrl: releases.coverUrl,
        accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
      })
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(
        and(
          eq(tracks.status, 'READY'),
          or(
            eq(releases.status, 'PUBLISHED'),
            and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
          ),
          eq(artistProfiles.isActive, true),
          excludeIds.length > 0 ? notInArray(tracks.id, excludeIds) : undefined,
          seedMood
            ? sql`EXISTS (SELECT 1 FROM track_moods tm WHERE tm.track_id = tracks.id AND tm.mood = ${seedMood})`
            : undefined,
        ),
      )
      .orderBy(sql`random()`)
      .limit(1);

    const rows = await q;
    if (rows.length === 0) return null;
    const r = rows[0];
    return { id: r.id, title: r.title, artistName: r.artistName, artistSlug: r.artistSlug, releaseId: r.releaseId, coverUrl: r.coverUrl, accentColor: r.accentColor };
  }

  // Получаем данные текущего трека: audio meta + mood + genre релиза
  const [[currentAudio], currentMoods, [currentReleaseRow]] = await Promise.all([
    db
      .select({ bpm: trackAudio.bpm, musicalKey: trackAudio.musicalKey })
      .from(trackAudio)
      .where(eq(trackAudio.trackId, currentTrackId)),
    db
      .select({ mood: trackMoods.mood })
      .from(trackMoods)
      .where(eq(trackMoods.trackId, currentTrackId)),
    db
      .select({ genre: releases.genre })
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .where(eq(tracks.id, currentTrackId))
      .limit(1),
  ]);

  const moodValues = currentMoods.map((m) => m.mood);
  const currentGenre = currentReleaseRow?.genre ?? null;
  const excludeIds = [currentTrackId, ...playedIds].filter(Boolean);

  // Строим score: 1 за каждый совпавший тег + 0.5 за близкий BPM
  const moodScore = moodValues.length > 0
    ? sql<number>`(
        SELECT COUNT(*)::float
        FROM track_moods tm2
        WHERE tm2.track_id = tracks.id
          AND tm2.mood = ANY(ARRAY[${sql.raw(moodValues.map((m) => `'${m}'`).join(','))}]::mood[])
      ) / NULLIF(${moodValues.length}, 0)`
    : sql<number>`0`;

  const bpmScore = currentAudio?.bpm
    ? sql<number>`CASE
        WHEN ${trackAudio.bpm} IS NULL THEN 0
        WHEN ABS(${trackAudio.bpm} - ${currentAudio.bpm}) <= 5 THEN 1.0
        WHEN ABS(${trackAudio.bpm} - ${currentAudio.bpm}) <= 15 THEN 0.5
        WHEN ABS(${trackAudio.bpm} - ${currentAudio.bpm}) <= 30 THEN 0.2
        ELSE 0
      END`
    : sql<number>`0`;

  const keyScore = currentAudio?.musicalKey
    ? sql<number>`CASE WHEN ${trackAudio.musicalKey} = ${currentAudio.musicalKey} THEN 0.5 ELSE 0 END`
    : sql<number>`0`;

  const genreScore = currentGenre
    ? sql<number>`CASE WHEN ${releases.genre} = ${currentGenre} THEN 0.3 ELSE 0 END`
    : sql<number>`0`;

  const totalScore = sql<number>`${moodScore} + ${bpmScore} + ${keyScore} + ${genreScore} + random() * 0.15`;

  const query = db
    .select({
      id: tracks.id,
      title: tracks.title,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      releaseId: releases.id,
      coverUrl: releases.coverUrl,
      accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
      score: totalScore,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .leftJoin(trackAudio, eq(trackAudio.trackId, tracks.id))
    .where(
      and(
        eq(tracks.status, 'READY'),
        or(
          eq(releases.status, 'PUBLISHED'),
          and(
            eq(releases.status, 'SCHEDULED'),
            isNotNull(releases.releaseDate),
            lte(releases.releaseDate, sql`now()`),
          ),
        ),
        eq(artistProfiles.isActive, true),
        excludeIds.length > 0
          ? notInArray(tracks.id, excludeIds)
          : undefined,
      ),
    )
    .orderBy(sql`${totalScore} DESC`)
    .limit(limit);

  const results = await query;
  if (results.length === 0) return null;

  const r = results[0];
  return {
    id: r.id,
    title: r.title,
    artistName: r.artistName,
    artistSlug: r.artistSlug,
    releaseId: r.releaseId,
    coverUrl: r.coverUrl,
    accentColor: r.accentColor,
  };
}

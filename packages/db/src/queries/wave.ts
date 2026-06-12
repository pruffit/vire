import { and, eq, ne, inArray, notInArray, sql, isNotNull, or, lte } from 'drizzle-orm';
import { db } from '../client';
import { trackMoods, trackAudio, tracks, releases, artistProfiles, trackGenres, likes } from '../schema';
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
 * Волна: подбирает следующий трек взвешенным SQL-скорингом (без ML).
 *
 * Ступень 1 (схожесть с текущим треком): mood-теги + близость BPM + тональность +
 *   жанр релиза + жанры трека (track_genres).
 * Ступень 2 (поведенческие сигналы):
 *   - качество: средняя доля дослушивания трека за 90 дней (скипы тянут вниз);
 *   - вовлечённость: число «любимых моментов» на треке;
 *   - профиль вкуса (для вошедших): совпадение с настроениями лайкнутых треков;
 *   - анти-усталость (для вошедших): штраф за треки, что слушатель слышал ≤7 дней.
 *
 * @param currentTrackId — текущий трек; null = seed-режим (случайный стартовый трек)
 * @param playedIds — уже сыгранные в сессии (не повторяем)
 * @param limit — сколько кандидатов вернуть
 * @param seedMood — только для seed-режима: стартовать с трека с этим тегом настроения
 * @param userId — слушатель (для профиля вкуса и анти-усталости); null = аноним
 */
export async function getWaveNextTrack(
  currentTrackId: string | null,
  playedIds: string[] = [],
  limit = 1,
  seedMood: Mood | null = null,
  userId: string | null = null,
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

  // Данные текущего трека: audio meta + mood + genre релиза + жанры трека.
  // Для вошедшего слушателя — профиль вкуса: топ-настроения его лайкнутых треков.
  const [[currentAudio], currentMoods, [currentReleaseRow], currentTrackGenreRows, tasteMoodRows] =
    await Promise.all([
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
      db
        .select({ genre: trackGenres.genre })
        .from(trackGenres)
        .where(eq(trackGenres.trackId, currentTrackId)),
      userId
        ? db
            .select({ mood: trackMoods.mood })
            .from(likes)
            .innerJoin(trackMoods, eq(trackMoods.trackId, likes.trackId))
            .where(eq(likes.userId, userId))
            .groupBy(trackMoods.mood)
            .orderBy(sql`count(*) DESC`)
            .limit(5)
        : Promise.resolve([] as { mood: Mood }[]),
    ]);

  const moodValues = currentMoods.map((m) => m.mood);
  const currentGenre = currentReleaseRow?.genre ?? null;
  const trackGenreValues = currentTrackGenreRows.map((g) => g.genre);
  const tasteMoodValues = tasteMoodRows.map((m) => m.mood);
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

  // Жанры трека (track_genres, до 3) — доля совпавших, вес до 0.4
  const trackGenreScore = trackGenreValues.length > 0
    ? sql<number>`(
        SELECT COUNT(*)::float
        FROM track_genres tg2
        WHERE tg2.track_id = tracks.id
          AND tg2.genre = ANY(ARRAY[${sql.raw(trackGenreValues.map((g) => `'${g}'`).join(','))}]::genre[])
      ) / NULLIF(${trackGenreValues.length}, 0) * 0.4`
    : sql<number>`0`;

  // ── Ступень 2: поведенческие сигналы ──────────────────────────────────────

  // Качество: средняя доля дослушивания за 90 дней (скипы тянут вниз), вес до 0.3
  const qualityScore = sql<number>`COALESCE((
      SELECT AVG(LEAST(1.0, pe.duration_played_sec::float / NULLIF(tracks.duration_sec, 0)))
      FROM play_events pe
      WHERE pe.track_id = tracks.id
        AND pe.started_at >= now() - interval '90 days'
    ), 0) * 0.3`;

  // Вовлечённость: число «любимых моментов», насыщается к 5, вес до 0.2
  const momentScore = sql<number>`LEAST(1.0, (
      SELECT COUNT(*)::float FROM favorite_moments fm WHERE fm.track_id = tracks.id
    ) / 5.0) * 0.2`;

  // Профиль вкуса: совпадение с настроениями лайкнутых треков слушателя, вес до 0.25
  const tasteMoodScore = tasteMoodValues.length > 0
    ? sql<number>`(
        SELECT COUNT(*)::float
        FROM track_moods tmt
        WHERE tmt.track_id = tracks.id
          AND tmt.mood = ANY(ARRAY[${sql.raw(tasteMoodValues.map((m) => `'${m}'`).join(','))}]::mood[])
      ) / NULLIF(${tasteMoodValues.length}, 0) * 0.25`
    : sql<number>`0`;

  // Анти-усталость: штраф за треки, что слушатель слышал за последние 7 дней
  const fatiguePenalty = userId
    ? sql<number>`CASE WHEN EXISTS (
        SELECT 1 FROM play_events pe3
        WHERE pe3.track_id = tracks.id
          AND pe3.user_id = ${userId}::uuid
          AND pe3.started_at >= now() - interval '7 days'
      ) THEN -0.6 ELSE 0 END`
    : sql<number>`0`;

  const totalScore = sql<number>`${moodScore} + ${bpmScore} + ${keyScore} + ${genreScore}
    + ${trackGenreScore} + ${qualityScore} + ${momentScore} + ${tasteMoodScore} + ${fatiguePenalty}
    + random() * 0.15`;

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

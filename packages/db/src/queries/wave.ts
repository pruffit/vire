import { and, eq, inArray, notInArray, sql, isNotNull, or, lte, type SQL } from 'drizzle-orm';
import { db } from '../client';
import { trackMoods, trackAudio, tracks, releases, artistProfiles, trackGenres } from '../schema';
import { expandGenresToFamilies } from '../genre-families';
import { featFromCredits } from './track-credits';
import type { Mood } from './track-moods';
import type { TrackGenre } from './track-genres';
import type { TasteProfile } from './taste';

export interface WaveTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean;
  version: string | null;
  feat: string[];
}

export interface WaveParams {
  currentTrackId: string | null;
  excludeIds: string[];
  limit: number;
  seedMood: Mood | null;
  seedGenre: TrackGenre | null;
  sessionMood: Mood | null;
  sessionGenre: TrackGenre | null;
  taste: TasteProfile | null;
  keySets: { exact: string[]; neighbor: string[] } | null;
  recentArtistIds: string[];
  userId: string | null;
}

// значения биндятся как параметры — в SQL-текст попадает только ARRAY[$1, $2, ...]::text[]
export function textArrayParam(values: readonly string[]): SQL {
  if (values.length === 0) return sql`ARRAY[]::text[]`;
  return sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::text[]`;
}

// GREATEST(точный, семейный), не сумма — точный жанр входит в свою семью, иначе двойной счёт.
// Веса — sql.raw, не bind-параметры: CASE...THEN $n Postgres вывел бы как integer, округлив 0.2 → 0.
function genreOverlapTerm(
  exactValues: readonly string[],
  familyValues: readonly string[],
  exactWeight: number,
  familyWeight: number,
): SQL<number> {
  if (exactValues.length === 0) return sql<number>`0`;
  const ew = sql.raw(exactWeight.toString());
  const fw = sql.raw(familyWeight.toString());
  return sql<number>`GREATEST(
      (
        SELECT COUNT(*)::float FROM track_genres tg_exact
        WHERE tg_exact.track_id = tracks.id AND tg_exact.genre::text = ANY(${textArrayParam(exactValues)})
      ) / ${exactValues.length} * ${ew},
      CASE WHEN EXISTS (
        SELECT 1 FROM track_genres tg_fam
        WHERE tg_fam.track_id = tracks.id AND tg_fam.genre::text = ANY(${textArrayParam(familyValues)})
      ) THEN ${fw} ELSE 0 END
    )`;
}

export const visibleTrackWhere = and(
  eq(tracks.status, 'READY'),
  or(
    eq(releases.status, 'PUBLISHED'),
    and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
  ),
  eq(artistProfiles.isActive, true),
);

const selectShape = {
  id: tracks.id,
  title: tracks.title,
  artistName: artistProfiles.name,
  artistSlug: artistProfiles.slug,
  releaseId: releases.id,
  coverUrl: releases.coverUrl,
  accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
  isExplicit: tracks.isExplicit,
  version: tracks.version,
  credits: tracks.credits,
};

function toWaveTrack(r: {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean;
  version: string | null;
  credits: unknown;
}): WaveTrack {
  return {
    id: r.id,
    title: r.title,
    artistName: r.artistName,
    artistSlug: r.artistSlug,
    releaseId: r.releaseId,
    coverUrl: r.coverUrl,
    accentColor: r.accentColor,
    isExplicit: r.isExplicit,
    version: r.version,
    feat: featFromCredits(r.credits),
  };
}

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

export async function getTrackMusicalKey(trackId: string): Promise<string | null> {
  const rows = await db
    .select({ musicalKey: trackAudio.musicalKey })
    .from(trackAudio)
    .where(eq(trackAudio.trackId, trackId));
  return rows[0]?.musicalKey ?? null;
}

/** Артисты (дедуплицированные id) владеющие переданными треками — для анти-усталости по разнообразию. */
export async function getArtistIdsForTracks(trackIds: string[]): Promise<string[]> {
  if (trackIds.length === 0) return [];
  const rows = await db
    .select({ artistId: artistProfiles.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(inArray(tracks.id, trackIds));
  return Array.from(new Set(rows.map((r) => r.artistId)));
}

/** Подбирает следующие треки взвешенным SQL-скорингом (без ML) — алгоритм см. docs/features/wave.md. */
export async function getWaveTracks(p: WaveParams): Promise<WaveTrack[]> {
  const limit = Math.max(1, Math.min(5, p.limit));
  const excludeIds = Array.from(new Set([p.currentTrackId, ...p.excludeIds].filter((v): v is string => Boolean(v))));

  // Фильтр по настроению: трек обязан иметь этот mood-тег.
  const moodFilterFor = (m: Mood | null): SQL | undefined =>
    m
      ? sql`EXISTS (SELECT 1 FROM track_moods tmf WHERE tmf.track_id = tracks.id AND tmf.mood = ${m})`
      : undefined;

  // расширяем до всего семейства (не только точный подшанр) — иначе узкие жанры разрежают выдачу
  const genreFamilyFilterFor = (g: TrackGenre | null): SQL | undefined => {
    if (!g) return undefined;
    const family = expandGenresToFamilies([g]);
    return sql`(
        EXISTS (
          SELECT 1 FROM track_genres tgf
          WHERE tgf.track_id = tracks.id AND tgf.genre::text = ANY(${textArrayParam(family)})
        )
        OR (
          NOT EXISTS (SELECT 1 FROM track_genres tgf2 WHERE tgf2.track_id = tracks.id)
          AND ${releases.genre}::text = ANY(${textArrayParam(family)})
        )
      )`;
  };

  // верхний ярус сортировки — точный жанр исчерпывается раньше соседей по семейству
  const genreExactTierFor = (g: TrackGenre | null): SQL<number> =>
    g
      ? sql<number>`CASE
          WHEN EXISTS (SELECT 1 FROM track_genres tge WHERE tge.track_id = tracks.id AND tge.genre = ${g}) THEN 1
          WHEN NOT EXISTS (SELECT 1 FROM track_genres tge2 WHERE tge2.track_id = tracks.id)
            AND ${releases.genre} = ${g} THEN 1
          ELSE 0
        END`
      : sql<number>`0`;

  // ── Seed-режим: без текущего трека — нет сигналов похожести ───────────────
  if (!p.currentTrackId) {
    const where = and(
      visibleTrackWhere,
      excludeIds.length > 0 ? notInArray(tracks.id, excludeIds) : undefined,
      moodFilterFor(p.seedMood),
      genreFamilyFilterFor(p.seedGenre),
    );

    if (p.taste) {
      const tasteMoodValues = p.taste.topMoods;
      const tasteGenreValues = p.taste.topGenres;

      const tasteMoodScore = tasteMoodValues.length > 0
        ? sql<number>`(
            SELECT COUNT(*)::float
            FROM track_moods tmt
            WHERE tmt.track_id = tracks.id
              AND tmt.mood::text = ANY(${textArrayParam(tasteMoodValues)})
          ) / ${tasteMoodValues.length} * 0.25`
        : sql<number>`0`;

      const tasteGenreScoreSeed = genreOverlapTerm(
        tasteGenreValues,
        expandGenresToFamilies(tasteGenreValues),
        0.4,
        0.2,
      );

      const totalScore = sql<number>`${tasteMoodScore} + ${tasteGenreScoreSeed} + ${qualityScore} + random() * 0.3`;

      const rows = await db
        .select(selectShape)
        .from(tracks)
        .innerJoin(releases, eq(releases.id, tracks.releaseId))
        .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
        .where(where)
        .orderBy(sql`${genreExactTierFor(p.seedGenre)} DESC`, sql`${totalScore} DESC`)
        .limit(limit);

      return rows.map(toWaveTrack);
    }

    // Аноним: популярность за 30 дней со случайной ротацией
    const plays30 = sql<number>`(
      SELECT COUNT(*)::float FROM play_events pe4
      WHERE pe4.track_id = tracks.id AND pe4.started_at >= now() - interval '30 days'
    )`;

    const rows = await db
      .select(selectShape)
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(where)
      .orderBy(sql`${genreExactTierFor(p.seedGenre)} DESC`, sql`ln(${plays30} + 1) * random() DESC`)
      .limit(limit);

    return rows.map(toWaveTrack);
  }

  // ── Похожесть с текущим треком + поведенческие сигналы ────────────────────
  const [[currentAudio], currentMoods, [currentReleaseRow], currentTrackGenreRows] = await Promise.all([
    db
      .select({ bpm: trackAudio.bpm })
      .from(trackAudio)
      .where(eq(trackAudio.trackId, p.currentTrackId)),
    db
      .select({ mood: trackMoods.mood })
      .from(trackMoods)
      .where(eq(trackMoods.trackId, p.currentTrackId)),
    db
      .select({ genre: releases.genre })
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .where(eq(tracks.id, p.currentTrackId))
      .limit(1),
    db
      .select({ genre: trackGenres.genre })
      .from(trackGenres)
      .where(eq(trackGenres.trackId, p.currentTrackId)),
  ]);

  const moodValues = currentMoods.map((m) => m.mood);
  const currentGenre = currentReleaseRow?.genre ?? null;
  const trackGenreValues = currentTrackGenreRows.map((g) => g.genre);
  const tasteMoodValues = p.taste?.topMoods ?? [];
  const tasteGenreValues = p.taste?.topGenres ?? [];

  const moodScore = moodValues.length > 0
    ? sql<number>`(
        SELECT COUNT(*)::float
        FROM track_moods tm2
        WHERE tm2.track_id = tracks.id
          AND tm2.mood::text = ANY(${textArrayParam(moodValues)})
      ) / ${moodValues.length}`
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

  // musical_key кандидата против наборов совместимых написаний (точные/соседние по кругу квинт)
  const keyScore = p.keySets && (p.keySets.exact.length > 0 || p.keySets.neighbor.length > 0)
    ? sql<number>`CASE
        WHEN lower(regexp_replace(${trackAudio.musicalKey}, '[\\s-]', '', 'g')) = ANY(${textArrayParam(p.keySets.exact)}) THEN 0.5
        WHEN lower(regexp_replace(${trackAudio.musicalKey}, '[\\s-]', '', 'g')) = ANY(${textArrayParam(p.keySets.neighbor)}) THEN 0.3
        ELSE 0
      END`
    : sql<number>`0`;

  // приоритет track_genres кандидата; фолбэк на releases.genre только если своих тегов нет
  const trackGenreOverlap = genreOverlapTerm(
    trackGenreValues,
    expandGenresToFamilies(trackGenreValues),
    0.4,
    0.2,
  );

  const releaseGenreFallback = currentGenre
    ? sql<number>`CASE WHEN ${releases.genre} = ${currentGenre} THEN 0.3 ELSE 0 END`
    : sql<number>`0`;

  const genreScore = sql<number>`CASE
      WHEN EXISTS (SELECT 1 FROM track_genres tgx WHERE tgx.track_id = tracks.id) THEN ${trackGenreOverlap}
      ELSE ${releaseGenreFallback}
    END`;

  // Профиль вкуса: совпадение с настроениями лайкнутых/играных треков, вес до 0.25
  const tasteMoodScore = tasteMoodValues.length > 0
    ? sql<number>`(
        SELECT COUNT(*)::float
        FROM track_moods tmt
        WHERE tmt.track_id = tracks.id
          AND tmt.mood::text = ANY(${textArrayParam(tasteMoodValues)})
      ) / ${tasteMoodValues.length} * 0.25`
    : sql<number>`0`;

  const tasteGenreScore = genreOverlapTerm(
    tasteGenreValues,
    expandGenresToFamilies(tasteGenreValues),
    0.25,
    0.125,
  );

  // Анти-усталость: штраф за треки, что слушатель слышал за последние 7 дней
  const fatiguePenalty = p.userId
    ? sql<number>`CASE WHEN EXISTS (
        SELECT 1 FROM play_events pe3
        WHERE pe3.track_id = tracks.id
          AND pe3.user_id = ${p.userId}::uuid
          AND pe3.started_at >= now() - interval '7 days'
      ) THEN -0.6 ELSE 0 END`
    : sql<number>`0`;

  // Разнообразие артистов: штраф за артистов последних выданных треков
  const diversityPenalty = p.recentArtistIds.length > 0
    ? sql<number>`CASE WHEN ${artistProfiles.id}::text = ANY(${textArrayParam(p.recentArtistIds)}) THEN -0.4 ELSE 0 END`
    : sql<number>`0`;

  const totalScore = sql<number>`${moodScore} + ${bpmScore} + ${keyScore} + ${genreScore}
    + ${tasteMoodScore} + ${tasteGenreScore} + ${qualityScore} + ${momentScore}
    + ${fatiguePenalty} + ${diversityPenalty}
    + random() * 0.15`;

  // закреплённый seed сессии — жёсткий фильтр, не буст: волна держится внутри жанра/настроения всю сессию
  const rows = await db
    .select({ ...selectShape, score: totalScore })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .leftJoin(trackAudio, eq(trackAudio.trackId, tracks.id))
    .where(
      and(
        visibleTrackWhere,
        excludeIds.length > 0 ? notInArray(tracks.id, excludeIds) : undefined,
        moodFilterFor(p.sessionMood),
        genreFamilyFilterFor(p.sessionGenre),
      ),
    )
    .orderBy(sql`${genreExactTierFor(p.sessionGenre)} DESC`, sql`${totalScore} DESC`)
    .limit(limit);

  return rows.map(toWaveTrack);
}

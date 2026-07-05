import { eq, inArray, isNull, or, and, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '../client';
import { trackAudio, tracks, releases, artistProfiles } from '../schema';

export interface TrackAudioData {
  hlsManifestKey: string;
  waveformPeaks: number[] | null;
  bpm: number | null;
  musicalKey: string | null;
  flacKey: string | null;
}

export async function getTrackAudio(trackId: string): Promise<TrackAudioData | null> {
  const [row] = await db
    .select({
      hlsManifestKey: trackAudio.hlsManifestKey,
      waveformPeaks: trackAudio.waveformPeaks,
      bpm: trackAudio.bpm,
      musicalKey: trackAudio.musicalKey,
      flacKey: trackAudio.flacKey,
    })
    .from(trackAudio)
    .where(eq(trackAudio.trackId, trackId))
    .limit(1);

  if (!row?.hlsManifestKey) return null;
  return {
    hlsManifestKey: row.hlsManifestKey,
    waveformPeaks: Array.isArray(row.waveformPeaks) ? (row.waveformPeaks as number[]) : null,
    bpm: row.bpm ?? null,
    musicalKey: row.musicalKey ?? null,
    flacKey: row.flacKey ?? null,
  };
}

export interface PlayableTrackAudioData extends TrackAudioData {
  artistProfileId: string;
}

/**
 * Как getTrackAudio, но только для действительно проигрываемого трека: READY,
 * релиз вышел (PUBLISHED или SCHEDULED с прошедшей датой), артист не скрыт.
 * null для всего остального (PROCESSING/BLOCKED/FAILED, DRAFT/ARCHIVED, isActive=false) —
 * защита manifest-роута от стрима непубличных треков по UUID.
 */
export async function getPlayableTrackAudio(trackId: string): Promise<PlayableTrackAudioData | null> {
  const [row] = await db
    .select({
      hlsManifestKey: trackAudio.hlsManifestKey,
      waveformPeaks: trackAudio.waveformPeaks,
      bpm: trackAudio.bpm,
      musicalKey: trackAudio.musicalKey,
      flacKey: trackAudio.flacKey,
      artistProfileId: releases.artistProfileId,
    })
    .from(trackAudio)
    .innerJoin(tracks, eq(tracks.id, trackAudio.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(trackAudio.trackId, trackId),
        eq(tracks.status, 'READY'),
        eq(artistProfiles.isActive, true),
        or(
          eq(releases.status, 'PUBLISHED'),
          and(eq(releases.status, 'SCHEDULED'), lte(releases.releaseDate, sql`now()`)),
        ),
      ),
    )
    .limit(1);

  if (!row?.hlsManifestKey) return null;
  return {
    hlsManifestKey: row.hlsManifestKey,
    waveformPeaks: Array.isArray(row.waveformPeaks) ? (row.waveformPeaks as number[]) : null,
    bpm: row.bpm ?? null,
    musicalKey: row.musicalKey ?? null,
    flacKey: row.flacKey ?? null,
    artistProfileId: row.artistProfileId,
  };
}

/** Артист-владелец трека (через релиз) — для owner-проверки, независимо от статусов. */
export async function getTrackArtistProfileId(trackId: string): Promise<string | null> {
  const [row] = await db
    .select({ artistProfileId: releases.artistProfileId })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(eq(tracks.id, trackId))
    .limit(1);
  return row?.artistProfileId ?? null;
}

/**
 * Ключ исходного мастера (wav/flac) в vault — для повторного транскода. В отличие
 * от getTrackAudio, отдаёт flacKey даже если HLS-манифест отсутствует/битый
 * (тогда как раз и нужен ре-транскод). null — исходника нет, пересобрать нечем.
 */
export async function getTrackSourceKey(trackId: string): Promise<string | null> {
  const [row] = await db
    .select({ flacKey: trackAudio.flacKey })
    .from(trackAudio)
    .where(eq(trackAudio.trackId, trackId))
    .limit(1);
  return row?.flacKey ?? null;
}

/**
 * Все треки артиста, у которых есть исходник в vault — для МАССОВОГО пере-транскода
 * (когда у артиста системно битый HLS, напр. вшитая обложка-видео). Возвращает пары
 * {trackId, sourceKey=flacKey}. Треки без исходника пропускаются.
 */
export async function getArtistTrackSources(
  artistProfileId: string,
): Promise<Array<{ trackId: string; sourceKey: string }>> {
  const rows = await db
    .select({ trackId: tracks.id, flacKey: trackAudio.flacKey })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(trackAudio, eq(trackAudio.trackId, tracks.id))
    .where(and(eq(releases.artistProfileId, artistProfileId), isNotNull(trackAudio.flacKey)));
  return rows
    .filter((r): r is { trackId: string; flacKey: string } => r.flacKey !== null)
    .map((r) => ({ trackId: r.trackId, sourceKey: r.flacKey }));
}

export async function getTrackAudioMeta(
  trackIds: string[],
): Promise<Record<string, { bpm: number | null; musicalKey: string | null }>> {
  if (trackIds.length === 0) return {};
  const rows = await db
    .select({ trackId: trackAudio.trackId, bpm: trackAudio.bpm, musicalKey: trackAudio.musicalKey })
    .from(trackAudio)
    .where(inArray(trackAudio.trackId, trackIds));
  const result: Record<string, { bpm: number | null; musicalKey: string | null }> = {};
  for (const row of rows) {
    result[row.trackId] = { bpm: row.bpm ?? null, musicalKey: row.musicalKey ?? null };
  }
  return result;
}

/** Треки, у которых нет bpm или тональности, но есть исходник в vault. */
export async function listTracksNeedingAnalysis(): Promise<Array<{ trackId: string; flacKey: string }>> {
  const rows = await db
    .select({ trackId: trackAudio.trackId, flacKey: trackAudio.flacKey })
    .from(trackAudio)
    .innerJoin(tracks, eq(tracks.id, trackAudio.trackId))
    .where(
      and(
        eq(tracks.status, 'READY'),
        isNotNull(trackAudio.flacKey),
        or(isNull(trackAudio.bpm), isNull(trackAudio.musicalKey)),
      ),
    );
  return rows.filter((r): r is { trackId: string; flacKey: string } => r.flacKey !== null);
}

export async function updateTrackAnalysis(
  trackId: string,
  bpm: number | null,
  musicalKey: string | null,
): Promise<void> {
  await db
    .update(trackAudio)
    .set({ bpm, musicalKey, updatedAt: new Date() })
    .where(eq(trackAudio.trackId, trackId));
}

export interface GenreSuggestionRow {
  genre: string;
  confidence: number;
}

/** Предложенные автоопределением жанры (топ-5) — для подсказки в GenrePicker. */
export async function getGenreSuggestionsForTracks(
  trackIds: string[],
): Promise<Record<string, GenreSuggestionRow[]>> {
  if (trackIds.length === 0) return {};
  const rows = await db
    .select({ trackId: trackAudio.trackId, genreSuggestions: trackAudio.genreSuggestions })
    .from(trackAudio)
    .where(inArray(trackAudio.trackId, trackIds));
  const result: Record<string, GenreSuggestionRow[]> = {};
  for (const row of rows) {
    if (Array.isArray(row.genreSuggestions)) {
      result[row.trackId] = row.genreSuggestions as GenreSuggestionRow[];
    }
  }
  return result;
}

export interface GenreSuggestionsSnapshot {
  suggestions: GenreSuggestionRow[];
  updatedAt: string | null;
}

/**
 * Снимок suggestions + updatedAt для одного трека — используется поллингом
 * анализа по требованию (`use-genre-analysis`): updatedAt меняется даже если
 * новые suggestions совпали с предыдущими (детерминированная модель), а само
 * появление данных — нет, если трек уже анализировался раньше.
 */
export async function getGenreSuggestionsSnapshot(trackId: string): Promise<GenreSuggestionsSnapshot> {
  const [row] = await db
    .select({ genreSuggestions: trackAudio.genreSuggestions, updatedAt: trackAudio.updatedAt })
    .from(trackAudio)
    .where(eq(trackAudio.trackId, trackId))
    .limit(1);
  return {
    suggestions: Array.isArray(row?.genreSuggestions) ? (row.genreSuggestions as GenreSuggestionRow[]) : [],
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

/** Сохраняет топ-5 предложений жанра для анализа по требованию (не трогает остальные поля trackAudio). */
export async function saveGenreSuggestions(
  trackId: string,
  suggestions: GenreSuggestionRow[],
): Promise<void> {
  await db
    .update(trackAudio)
    .set({ genreSuggestions: suggestions, updatedAt: new Date() })
    .where(eq(trackAudio.trackId, trackId));
}

export async function trackExists(trackId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);
  return !!row;
}

export async function getTrackTitle(trackId: string): Promise<string | null> {
  const [row] = await db
    .select({ title: tracks.title })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);
  return row?.title ?? null;
}

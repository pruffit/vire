import { eq, inArray, isNull, or, and, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '../client';
import { trackAudio, tracks, releases, artistProfiles, trackGenres } from '../schema';
import type { TrackGenre } from './track-genres';

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
 * Как getTrackAudio, но только для проигрываемого трека: READY, релиз вышел, артист
 * не скрыт. null иначе, защита manifest-роута от стрима непубличных треков по UUID.
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

/** Артист-владелец трека (через релиз), для owner-проверки, независимо от статусов. */
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
 * Ключ исходного мастера (vault), для ре-транскода. В отличие от getTrackAudio,
 * отдаёт flacKey даже при отсутствующем/битом HLS-манифесте, именно тогда он нужен.
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
 * Все треки артиста с исходником в vault, для массового пере-транскода (когда у
 * артиста системно битый HLS, напр. вшитая обложка-видео).
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
    .set({ bpm, musicalKey, bpmKeyAnalyzedAt: new Date(), updatedAt: new Date() })
    .where(eq(trackAudio.trackId, trackId));
}

export interface GenreSuggestionRow {
  genre: string;
  confidence: number;
}

/** Предложенные автоопределением жанры (топ-5), для подсказки в GenrePicker. */
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
  // Жанры, реально проставленные треку на момент снимка; см. docs/features/auto-genre.md.
  appliedGenres: TrackGenre[];
}

/**
 * Снимок suggestions + appliedGenres + updatedAt для поллинга (`use-genre-analysis`);
 * раздельные таймстемпы готовности: см. docs/features/audio-analysis.md.
 */
export async function getGenreSuggestionsSnapshot(trackId: string): Promise<GenreSuggestionsSnapshot> {
  const [[row], genreRows] = await Promise.all([
    db
      .select({ genreSuggestions: trackAudio.genreSuggestions, genreAnalyzedAt: trackAudio.genreAnalyzedAt })
      .from(trackAudio)
      .where(eq(trackAudio.trackId, trackId))
      .limit(1),
    db.select({ genre: trackGenres.genre }).from(trackGenres).where(eq(trackGenres.trackId, trackId)),
  ]);
  return {
    suggestions: Array.isArray(row?.genreSuggestions) ? (row.genreSuggestions as GenreSuggestionRow[]) : [],
    updatedAt: row?.genreAnalyzedAt ? row.genreAnalyzedAt.toISOString() : null,
    appliedGenres: genreRows.map((r) => r.genre),
  };
}

/** Сохраняет топ-5 предложений жанра для анализа по требованию (не трогает остальные поля trackAudio). */
export async function saveGenreSuggestions(
  trackId: string,
  suggestions: GenreSuggestionRow[],
): Promise<void> {
  await db
    .update(trackAudio)
    .set({ genreSuggestions: suggestions, genreAnalyzedAt: new Date(), updatedAt: new Date() })
    .where(eq(trackAudio.trackId, trackId));
}

export interface AudioFeaturesSnapshot {
  bpm: number | null;
  musicalKey: string | null;
  updatedAt: string | null;
}

/**
 * Снимок bpm/тональности + updatedAt для поллинга (`use-track-analysis`);
 * раздельные таймстемпы готовности: см. docs/features/audio-analysis.md.
 */
export async function getAudioFeaturesSnapshot(trackId: string): Promise<AudioFeaturesSnapshot> {
  const [row] = await db
    .select({ bpm: trackAudio.bpm, musicalKey: trackAudio.musicalKey, bpmKeyAnalyzedAt: trackAudio.bpmKeyAnalyzedAt })
    .from(trackAudio)
    .where(eq(trackAudio.trackId, trackId))
    .limit(1);
  return {
    bpm: row?.bpm ?? null,
    musicalKey: row?.musicalKey ?? null,
    updatedAt: row?.bpmKeyAnalyzedAt ? row.bpmKeyAnalyzedAt.toISOString() : null,
  };
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

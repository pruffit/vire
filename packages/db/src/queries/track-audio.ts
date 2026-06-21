import { eq, inArray, isNull, or, and, isNotNull } from 'drizzle-orm';
import { db } from '../client';
import { trackAudio, tracks } from '../schema';

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

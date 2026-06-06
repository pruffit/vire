import { eq } from 'drizzle-orm';
import { db } from '../client';
import { trackAudio, tracks } from '../schema';

export interface TrackAudioData {
  hlsManifestKey: string;
  waveformPeaks: number[] | null;
  bpm: number | null;
  musicalKey: string | null;
}

export async function getTrackAudio(trackId: string): Promise<TrackAudioData | null> {
  const [row] = await db
    .select({
      hlsManifestKey: trackAudio.hlsManifestKey,
      waveformPeaks: trackAudio.waveformPeaks,
      bpm: trackAudio.bpm,
      musicalKey: trackAudio.musicalKey,
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

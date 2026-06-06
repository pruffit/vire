import { eq } from 'drizzle-orm';
import { db } from '../client';
import { trackAudio } from '../schema';

export interface TrackAudioData {
  hlsManifestKey: string;
  waveformPeaks: number[] | null;
}

export async function getTrackAudio(trackId: string): Promise<TrackAudioData | null> {
  const [row] = await db
    .select({ hlsManifestKey: trackAudio.hlsManifestKey, waveformPeaks: trackAudio.waveformPeaks })
    .from(trackAudio)
    .where(eq(trackAudio.trackId, trackId))
    .limit(1);

  if (!row?.hlsManifestKey) return null;
  return {
    hlsManifestKey: row.hlsManifestKey,
    waveformPeaks: Array.isArray(row.waveformPeaks) ? (row.waveformPeaks as number[]) : null,
  };
}

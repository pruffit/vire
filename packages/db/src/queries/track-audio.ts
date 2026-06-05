import { eq } from 'drizzle-orm';
import { db } from '../client';
import { trackAudio } from '../schema';

export async function getHlsManifestKey(trackId: string): Promise<string | null> {
  const [row] = await db
    .select({ hlsManifestKey: trackAudio.hlsManifestKey })
    .from(trackAudio)
    .where(eq(trackAudio.trackId, trackId))
    .limit(1);

  return row?.hlsManifestKey ?? null;
}

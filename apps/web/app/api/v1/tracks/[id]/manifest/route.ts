import { NextResponse } from 'next/server';
import { db, getPlayableTrackAudio, getTrackAudio, getTrackArtistProfileId, DrizzleArtistRepository, type TrackAudioData } from '@vire/db';
import { auth } from '@/auth';
import { can } from '@vire/core/access';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const rl = await rateLimit(clientKey(req, 'manifest'), 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;

  let audio: TrackAudioData | null = await getPlayableTrackAudio(id);

  if (!audio) {
    const session = await auth();
    const userId = session?.user?.id;

    let allowed = !!session?.user && can(session.user, 'staff.content.preview');
    if (!allowed && userId) {
      const artistProfileId = await getTrackArtistProfileId(id);
      allowed = artistProfileId != null && !!(await new DrizzleArtistRepository(db).findByIdForUser(artistProfileId, userId));
    }

    if (!allowed) {
      return NextResponse.json({ error: 'No audio available' }, { status: 404 });
    }

    audio = await getTrackAudio(id);
    if (!audio) {
      return NextResponse.json({ error: 'No audio available' }, { status: 404 });
    }
  }

  const base = `${process.env.S3_PUBLIC_ENDPOINT}/${process.env.S3_BUCKET_STREAM}`;
  return NextResponse.json({
    hlsUrl: `${base}/${audio.hlsManifestKey}`,
    waveformPeaks: audio.waveformPeaks,
  });
}

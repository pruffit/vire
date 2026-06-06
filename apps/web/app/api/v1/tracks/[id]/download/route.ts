import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasPurchasedTrack, getTrackAudio, trackExists } from '@vire/db';
import { getSourceDownloadUrl } from '@/lib/s3';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: trackId } = await params;

  if (!(await trackExists(trackId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!(await hasPurchasedTrack(session.user.id, trackId))) {
    return NextResponse.json({ error: 'Not purchased' }, { status: 403 });
  }

  const audio = await getTrackAudio(trackId);
  if (!audio?.flacKey) {
    return NextResponse.json({ error: 'Audio not ready' }, { status: 404 });
  }

  // Extract filename from the URL params or use trackId as fallback
  const url = new URL(req.url);
  const filename = url.searchParams.get('filename') || trackId;

  const signedUrl = await getSourceDownloadUrl(audio.flacKey, filename);
  redirect(signedUrl);
}

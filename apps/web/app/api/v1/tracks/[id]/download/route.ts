import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { hasPurchasedTrack, getTrackAudio, trackExists } from '@vire/db';
import { getSourceDownloadUrl } from '@/lib/s3';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: trackId } = await params;

  if (!(await trackExists(trackId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!(await hasPurchasedTrack(caller.id, trackId))) {
    return NextResponse.json({ error: 'Not purchased' }, { status: 403 });
  }

  const audio = await getTrackAudio(trackId);
  if (!audio?.flacKey) {
    return NextResponse.json({ error: 'Audio not ready' }, { status: 404 });
  }

  const url = new URL(req.url);
  const filename = url.searchParams.get('filename') || trackId;

  const signedUrl = await getSourceDownloadUrl(audio.flacKey, filename);
  redirect(signedUrl);
}

import { NextResponse } from 'next/server';
import { getTrackAudio } from '@vire/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const audio = await getTrackAudio(id);

  if (!audio) {
    return NextResponse.json({ error: 'No audio available' }, { status: 404 });
  }

  const base = `${process.env.S3_PUBLIC_ENDPOINT}/${process.env.S3_BUCKET_STREAM}`;
  return NextResponse.json({
    hlsUrl: `${base}/${audio.hlsManifestKey}`,
    waveformPeaks: audio.waveformPeaks,
  });
}

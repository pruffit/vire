import { NextResponse } from 'next/server';
import { getTrackSourceKey } from '@vire/db';
import { requireOwnedTrack } from '@/lib/require-owned-track';
import { analyzeQueue } from '@/lib/queue';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const owned = await requireOwnedTrack(req, id);
  if (!owned.ok) return owned.response;

  const flacKey = await getTrackSourceKey(id);
  if (!flacKey) return NextResponse.json({ error: 'No source file' }, { status: 409 });

  await analyzeQueue.add({ trackId: id, flacKey });
  return NextResponse.json({ queued: true }, { status: 202 });
}

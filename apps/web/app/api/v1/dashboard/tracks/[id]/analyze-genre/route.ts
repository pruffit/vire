import { NextResponse } from 'next/server';
import { requireOwnedTrack } from '@/lib/require-owned-track';
import { analyzeGenreQueue } from '@/lib/queue';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const owned = await requireOwnedTrack(req, id);
  if (!owned.ok) return owned.response;

  await analyzeGenreQueue.add({ trackId: id });
  return NextResponse.json({ queued: true }, { status: 202 });
}

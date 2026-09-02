import { NextResponse } from 'next/server';
import { getAudioFeaturesSnapshot } from '@vire/db';
import { requireOwnedTrack } from '@/lib/require-owned-track';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const owned = await requireOwnedTrack(req, id);
  if (!owned.ok) return owned.response;

  const snapshot = await getAudioFeaturesSnapshot(id);
  return NextResponse.json(snapshot);
}

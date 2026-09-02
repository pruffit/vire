import { NextResponse } from 'next/server';
import { getGenreSuggestionsSnapshot } from '@vire/db';
import { requireOwnedTrack } from '@/lib/require-owned-track';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const owned = await requireOwnedTrack(req, id);
  if (!owned.ok) return owned.response;

  const snapshot = await getGenreSuggestionsSnapshot(id);
  return NextResponse.json(snapshot);
}

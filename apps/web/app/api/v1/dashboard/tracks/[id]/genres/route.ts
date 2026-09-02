import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setTrackGenres, ALL_TRACK_GENRES } from '@vire/db';
import { requireOwnedTrack } from '@/lib/require-owned-track';

type Params = { params: Promise<{ id: string }> };

const genreSchema = z.array(z.enum(ALL_TRACK_GENRES)).max(3);

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const owned = await requireOwnedTrack(req, id);
  if (!owned.ok) return owned.response;

  const body = await req.json().catch(() => null);
  const parsed = genreSchema.safeParse(body?.genres);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid genres' }, { status: 400 });

  await setTrackGenres(id, parsed.data);
  return NextResponse.json({ genres: parsed.data });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  ALL_MOODS, db,
  DrizzleTrackRepository, DrizzleReleaseRepository, DrizzleTrackMoodsRepository,
} from '@vire/db';
import { TrackMoodsService, NotFoundError, ValidationError } from '@vire/core';
import { getActiveArtist } from '@/lib/active-artist';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

const moodSchema = z.array(z.enum(ALL_MOODS)).max(5);

function trackMoodsService() {
  return new TrackMoodsService(
    new DrizzleTrackRepository(db),
    new DrizzleReleaseRepository(db),
    new DrizzleTrackMoodsRepository(db),
  );
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const result = await trackMoodsService().getMoods(id);
  if (!result.ok) return errorJson(result.error, 404);
  return NextResponse.json({ moods: result.value });
}

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = moodSchema.safeParse(body?.moods);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid moods' }, { status: 400 });

  const result = await trackMoodsService().setMoods(id, artist.id, parsed.data);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) return errorJson(result.error, 404);
    if (result.error instanceof ValidationError) {
      return errorJson(result.error, 400);
    }
    return errorJson(result.error, 403);
  }
  return NextResponse.json({ moods: parsed.data });
}

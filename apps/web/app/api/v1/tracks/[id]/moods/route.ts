import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  getTrackMoods, setTrackMoods, trackExists, ALL_MOODS, db,
  DrizzleTrackRepository, DrizzleReleaseRepository,
} from '@vire/db';
import { getActiveArtist } from '@/lib/active-artist';

type Params = { params: Promise<{ id: string }> };

const moodSchema = z.array(z.enum(ALL_MOODS)).max(5);

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  if (!(await trackExists(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const moods = await getTrackMoods(id);
  return NextResponse.json({ moods });
}

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const track = await new DrizzleTrackRepository(db).findById(id);
  if (!track) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const release = await new DrizzleReleaseRepository(db).findById(track.releaseId);
  if (!release || release.artistProfileId !== artist.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = moodSchema.safeParse(body?.moods);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid moods' }, { status: 400 });

  await setTrackMoods(id, parsed.data);
  return NextResponse.json({ moods: parsed.data });
}

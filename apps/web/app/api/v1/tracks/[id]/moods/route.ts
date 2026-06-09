import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getTrackMoods, setTrackMoods, trackExists, ALL_MOODS, db, DrizzleArtistRepository } from '@vire/db';

type Params = { params: Promise<{ id: string }> };

const moodSchema = z.array(z.enum(ALL_MOODS as [string, ...string[]])).max(5);

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
  if (!(await trackExists(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Только артист-владелец трека может менять настроения
  const artist = await new DrizzleArtistRepository(db).findByUserId(session.user.id);
  if (!artist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = moodSchema.safeParse(body?.moods);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid moods' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await setTrackMoods(id, parsed.data as any);
  return NextResponse.json({ moods: parsed.data });
}

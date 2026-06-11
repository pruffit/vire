import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  db, DrizzleArtistRepository, DrizzleTrackRepository, DrizzleReleaseRepository,
  setTrackGenres, ALL_TRACK_GENRES,
} from '@vire/db';
import { isUuid } from '@/lib/upload';

type Params = { params: Promise<{ id: string }> };

const genreSchema = z.array(z.enum(ALL_TRACK_GENRES as [string, ...string[]])).max(3);

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const artist = await new DrizzleArtistRepository(db).findByUserId(session.user.id);
  if (!artist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const track = await new DrizzleTrackRepository(db).findById(id);
  if (!track) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const release = await new DrizzleReleaseRepository(db).findById(track.releaseId);
  if (!release || release.artistProfileId !== artist.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = genreSchema.safeParse(body?.genres);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid genres' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await setTrackGenres(id, parsed.data as any);
  return NextResponse.json({ genres: parsed.data });
}

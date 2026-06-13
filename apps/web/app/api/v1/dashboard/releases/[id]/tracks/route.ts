import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository } from '@vire/db';
import { isUuid } from '@/lib/upload';
import { getActiveArtist } from '@/lib/active-artist';

// Лёгкий поллинг статусов треков релиза: фронт опрашивает, пока есть PROCESSING,
// чтобы показать переход «обрабатывается → готов» без перезагрузки страницы.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid release id' }, { status: 400 });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });

  const releaseRepo = new DrizzleReleaseRepository(db);
  const data = await releaseRepo.findWithTracks(id);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (data.release.artistProfileId !== artist.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    tracks: data.tracks.map((t) => ({ id: t.id, status: t.status })),
  });
}

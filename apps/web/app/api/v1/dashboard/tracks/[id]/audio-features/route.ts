import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleTrackRepository, DrizzleReleaseRepository, getAudioFeaturesSnapshot } from '@vire/db';
import { isUuid } from '@/lib/upload';
import { getActiveArtist } from '@/lib/active-artist';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const track = await new DrizzleTrackRepository(db).findById(id);
  if (!track) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const release = await new DrizzleReleaseRepository(db).findById(track.releaseId);
  if (!release || release.artistProfileId !== artist.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const snapshot = await getAudioFeaturesSnapshot(id);
  return NextResponse.json(snapshot);
}

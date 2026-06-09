import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, getArtistTrackIds } from '@vire/db';
import { countListeningMany } from '@/lib/presence';

/** Сколько слушателей прямо сейчас слушают треки этого артиста (для дашборда). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await new DrizzleArtistRepository(db).findByUserId(session.user.id);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  try {
    const trackIds = await getArtistTrackIds(artist.id);
    const count = await countListeningMany(trackIds);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

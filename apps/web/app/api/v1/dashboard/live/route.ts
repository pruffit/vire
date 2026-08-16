import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { getArtistTrackIds } from '@vire/db';
import { countListeningMany } from '@/lib/presence';
import { getActiveArtist } from '@/lib/active-artist';

/** Сколько слушателей прямо сейчас слушают треки этого артиста (для дашборда). */
export async function GET(req: Request) {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(caller.id, req);
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

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getUserPlaylists, getTrackPlaylistIds, createPlaylist } from '@vire/db';

const createSchema = z.object({
  title: z.string().min(1).max(100),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const trackIdParam = new URL(req.url).searchParams.get('trackId');
  const list = await getUserPlaylists(session.user.id);

  // ?trackId=<uuid> — какие из плейлистов уже содержат этот трек (для галочек)
  if (trackIdParam !== null) {
    const trackId = z.string().uuid().safeParse(trackIdParam);
    if (!trackId.success) return NextResponse.json({ error: 'Invalid trackId' }, { status: 400 });
    const inPlaylists = await getTrackPlaylistIds(session.user.id, trackId.data);
    return NextResponse.json({ playlists: list, inPlaylists });
  }

  return NextResponse.json({ playlists: list });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const id = await createPlaylist(session.user.id, parsed.data.title);
  return NextResponse.json({ id }, { status: 201 });
}

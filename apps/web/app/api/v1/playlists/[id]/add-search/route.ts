import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPlaylistWithTracks, searchTracksForPlaylist } from '@vire/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (playlist.ownerUserId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ tracks: [] });
  const exclude = playlist.tracks.map((t: { id: string }) => t.id);
  const tracks = await searchTracksForPlaylist(q, exclude, 20);
  return NextResponse.json({ tracks });
}

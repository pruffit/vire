import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { removeTrackFromPlaylist, getPlaylistWithTracks } from '@vire/db';

type Params = { params: Promise<{ id: string; trackId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, trackId } = await params;
  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (playlist.ownerUserId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await removeTrackFromPlaylist(id, trackId);
  return NextResponse.json({ ok: true });
}

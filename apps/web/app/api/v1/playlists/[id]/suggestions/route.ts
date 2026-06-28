import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPlaylistWithTracks, getPlaylistSuggestions } from '@vire/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (playlist.ownerUserId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const suggestions = await getPlaylistSuggestions(id, session.user.id);
  return NextResponse.json(suggestions);
}

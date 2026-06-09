import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { addTrackToPlaylist, getPlaylistWithTracks, trackExists } from '@vire/db';

type Params = { params: Promise<{ id: string }> };

const addSchema = z.object({ trackId: z.string().uuid() });

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (playlist.ownerUserId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  if (!(await trackExists(parsed.data.trackId)))
    return NextResponse.json({ error: 'Track not found' }, { status: 404 });

  await addTrackToPlaylist(id, parsed.data.trackId, session.user.id);
  return NextResponse.json({ ok: true });
}

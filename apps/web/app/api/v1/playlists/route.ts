import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { playlistService } from '@/lib/playlist';

const createSchema = z.object({
  title: z.string().min(1).max(100),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const trackIdParam = new URL(req.url).searchParams.get('trackId');

  // ?trackId=<uuid>: какие из плейлистов уже содержат этот трек (для галочек)
  let trackId: string | undefined;
  if (trackIdParam !== null) {
    const parsed = z.string().uuid().safeParse(trackIdParam);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid trackId' }, { status: 400 });
    trackId = parsed.data;
  }

  const result = await playlistService().listForUser(session.user.id, trackId);
  return NextResponse.json(result.ok ? result.value : { playlists: [] });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const result = await playlistService().create(session.user.id, parsed.data.title);
  if (!result.ok) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  return NextResponse.json({ id: result.value.id }, { status: 201 });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getUserPlaylists, createPlaylist } from '@vire/db';

const createSchema = z.object({
  title: z.string().min(1).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const list = await getUserPlaylists(session.user.id);
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

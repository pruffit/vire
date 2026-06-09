import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getPlaylistWithTracks, deletePlaylist, renamePlaylist } from '@vire/db';

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({ title: z.string().min(1).max(100).optional() });

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();

  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Приватные плейлисты видны только владельцу
  if (playlist.visibility === 'PRIVATE' && playlist.ownerUserId !== session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ playlist });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  if (parsed.data.title) {
    await renamePlaylist(id, session.user.id, parsed.data.title);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const deleted = await deletePlaylist(id, session.user.id);
  if (!deleted) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

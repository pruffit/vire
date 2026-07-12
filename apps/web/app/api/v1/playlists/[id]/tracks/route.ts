import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, DrizzlePlaylistRepository } from '@vire/db';
import { PlaylistService, NotFoundError, ConflictError } from '@vire/core';
import { playlistCoverStorage } from '@/lib/playlist-cover-storage';

type Params = { params: Promise<{ id: string }> };

const addSchema = z.object({ trackId: z.string().uuid() });

const reorderSchema = z.object({ trackIds: z.array(z.string().uuid()).min(1) });

function playlistService() {
  return new PlaylistService(new DrizzlePlaylistRepository(db), playlistCoverStorage, Date.now);
}

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const result = await playlistService().reorder(id, session.user.id, parsed.data.trackIds);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (result.error instanceof ConflictError) return NextResponse.json({ error: 'Reorder conflict' }, { status: 409 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}

// NotFoundError сливает Playlist и Track — различаем текст по message для 1:1 с прежним API.
function addTrackErrorText(error: Error): string {
  return error.message.startsWith('Track') ? 'Track not found' : 'Not found';
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const result = await playlistService().addTrack(id, session.user.id, parsed.data.trackId);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    const error = status === 404 ? addTrackErrorText(result.error) : 'Forbidden';
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ ok: true });
}

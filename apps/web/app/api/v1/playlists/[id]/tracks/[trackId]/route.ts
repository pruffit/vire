import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzlePlaylistRepository } from '@vire/db';
import { PlaylistService, NotFoundError } from '@vire/core';
import { playlistCoverStorage } from '@/lib/playlist-cover-storage';

type Params = { params: Promise<{ id: string; trackId: string }> };

function playlistService() {
  return new PlaylistService(new DrizzlePlaylistRepository(db), playlistCoverStorage, Date.now);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, trackId } = await params;
  const result = await playlistService().removeTrack(id, session.user.id, trackId);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
  }
  return NextResponse.json({ ok: true });
}

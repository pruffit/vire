import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzlePlaylistRepository } from '@vire/db';
import { PlaylistService } from '@vire/core';
import { playlistCoverStorage } from '@/lib/playlist-cover-storage';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

function playlistService() {
  return new PlaylistService(new DrizzlePlaylistRepository(db), playlistCoverStorage, Date.now);
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const result = await playlistService().getLikeState(session.user.id, id);
  return NextResponse.json({ liked: result.ok ? result.value : false });
}

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`playlist-like:${session.user.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;
  await playlistService().like(session.user.id, id);
  return NextResponse.json({ liked: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`playlist-like:${session.user.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;
  await playlistService().unlike(session.user.id, id);
  return NextResponse.json({ liked: false });
}

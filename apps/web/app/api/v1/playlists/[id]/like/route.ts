import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { likePlaylist, unlikePlaylist, getPlaylistLikeState } from '@vire/db';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const liked = await getPlaylistLikeState(session.user.id, id);
  return NextResponse.json({ liked });
}

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`playlist-like:${session.user.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;
  await likePlaylist(session.user.id, id);
  return NextResponse.json({ liked: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await unlikePlaylist(session.user.id, id);
  return NextResponse.json({ liked: false });
}

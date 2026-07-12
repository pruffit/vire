import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleListenerTrackRepository } from '@vire/db';
import { ListenerTrackService, NotFoundError } from '@vire/core';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

function listenerTrackService() {
  return new ListenerTrackService(new DrizzleListenerTrackRepository(db));
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const result = await listenerTrackService().getLikeState(session.user.id, id);
  return NextResponse.json({ liked: result.ok ? result.value : false });
}

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`like:${session.user.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;
  const result = await listenerTrackService().like(session.user.id, id);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
  }
  return NextResponse.json({ liked: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await listenerTrackService().unlike(session.user.id, id);
  return NextResponse.json({ liked: false });
}

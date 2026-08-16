import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { db, DrizzleListenerTrackRepository } from '@vire/db';
import { ListenerTrackService, NotFoundError } from '@vire/core';
import type { LikeResponse } from '@vire/api-contracts';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

function listenerTrackService() {
  return new ListenerTrackService(new DrizzleListenerTrackRepository(db));
}

export async function GET(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const result = await listenerTrackService().getLikeState(caller.id, id);
  return NextResponse.json({ liked: result.ok ? result.value : false } satisfies LikeResponse);
}

export async function POST(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`like:${caller.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;
  const result = await listenerTrackService().like(caller.id, id);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ liked: true } satisfies LikeResponse);
}

export async function DELETE(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`unlike:${caller.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;
  await listenerTrackService().unlike(caller.id, id);
  return NextResponse.json({ liked: false } satisfies LikeResponse);
}

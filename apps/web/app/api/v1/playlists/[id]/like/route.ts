import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import type { LikeResponse } from '@vire/api-contracts';
import { playlistService } from '@/lib/playlist';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const result = await playlistService().getLikeState(caller.id, id);
  return NextResponse.json({ liked: result.ok ? result.value : false } satisfies LikeResponse);
}

export async function POST(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`playlist-like:${caller.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;
  await playlistService().like(caller.id, id);
  return NextResponse.json({ liked: true } satisfies LikeResponse);
}

export async function DELETE(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`playlist-like:${caller.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;
  await playlistService().unlike(caller.id, id);
  return NextResponse.json({ liked: false } satisfies LikeResponse);
}

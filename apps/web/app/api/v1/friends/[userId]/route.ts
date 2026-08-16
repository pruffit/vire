import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { friendshipService } from '@/lib/friends';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { uuidSchema, type OkResponse } from '@vire/api-contracts';

type Ctx = { params: Promise<{ userId: string }> };

// decline/cancel/unfriend — одно и то же удаление ребра; сервис не различает по контракту REST.
export async function DELETE(_req: Request, { params }: Ctx) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`friend-remove:${caller.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const parsed = uuidSchema.safeParse((await params).userId);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

  await friendshipService().unfriend(caller.id, parsed.data);
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

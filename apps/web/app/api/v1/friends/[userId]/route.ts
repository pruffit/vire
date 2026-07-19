import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

const paramsSchema = z.object({ userId: z.string().uuid() });
type Ctx = { params: Promise<{ userId: string }> };

// decline/cancel/unfriend — одно и то же удаление ребра; сервис не различает по контракту REST.
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`friend-remove:${session.user.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

  await friendshipService().unfriend(session.user.id, parsed.data.userId);
  return NextResponse.json({ ok: true });
}

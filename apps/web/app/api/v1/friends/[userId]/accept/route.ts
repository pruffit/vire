import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';
import { NotFoundError } from '@vire/core';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

const paramsSchema = z.object({ userId: z.string().uuid() });
type Ctx = { params: Promise<{ userId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`friend-accept:${session.user.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

  const result = await friendshipService().accept(session.user.id, parsed.data.userId);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ ok: true });
}

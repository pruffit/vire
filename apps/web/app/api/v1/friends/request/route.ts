import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';
import { NotFoundError, ValidationError } from '@vire/core';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

const schema = z.object({ userId: z.string().uuid() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`friend-request:${session.user.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await friendshipService().request(session.user.id, parsed.data.userId);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) return errorJson(result.error, 404);
    if (result.error instanceof ValidationError) return errorJson(result.error, 422);
    return errorJson(result.error, 403);
  }
  return NextResponse.json({ status: result.value });
}

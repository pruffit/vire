import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { friendshipService } from '@/lib/friends';
import { NotFoundError, ValidationError } from '@vire/core';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';
import { friendRequestBodySchema, type FriendRequestResponse } from '@vire/api-contracts';

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`friend-request:${caller.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await req.json().catch(() => null);
  const parsed = friendRequestBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await friendshipService().request(caller.id, parsed.data.userId);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) return errorJson(result.error, 404);
    if (result.error instanceof ValidationError) return errorJson(result.error, 422);
    return errorJson(result.error, 403);
  }
  return NextResponse.json({ status: result.value } satisfies FriendRequestResponse);
}

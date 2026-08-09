import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import { ValidationError } from '@vire/core';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

const schema = z.object({
  toUserId: z.string().uuid(),
  ciphertext: z.string().min(1).max(12000),
  nonce: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`chat-send:${session.user.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await chatService().send(
    session.user.id,
    parsed.data.toUserId,
    { ciphertext: parsed.data.ciphertext, nonce: parsed.data.nonce },
    session.user.name,
  );
  if (!result.ok) {
    const status = result.error instanceof ValidationError ? 422 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json(result.value);
}

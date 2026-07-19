import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import { ValidationError } from '@vire/core';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

const schema = z.object({ userId: z.string().uuid() });

/** Открыть (или получить существующий) диалог с другом — вход из кнопки «Написать» на профиле. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`chat-open:${session.user.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await chatService().openOrGet(session.user.id, parsed.data.userId);
  if (!result.ok) {
    const status = result.error instanceof ValidationError ? 422 : 403;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(result.value);
}

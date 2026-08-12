import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import { ValidationError } from '@vire/core';
import { openChatSchema, type OpenChatResponse } from '@vire/api-contracts';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

/** Открыть (или получить существующий) диалог с другом — вход из кнопки «Написать» на профиле. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`chat-open:${session.user.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const json = await req.json().catch(() => null);
  const parsed = openChatSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await chatService().openOrGet(session.user.id, parsed.data.userId);
  if (!result.ok) {
    const status = result.error instanceof ValidationError ? 422 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json(result.value satisfies OpenChatResponse);
}

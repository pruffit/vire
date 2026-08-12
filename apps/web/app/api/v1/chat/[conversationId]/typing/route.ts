import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import { publish } from '@/lib/realtime';
import { NotFoundError } from '@vire/core';
import type { OkResponse } from '@vire/api-contracts';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

const paramsSchema = z.object({ conversationId: z.string().uuid() });

type Ctx = { params: Promise<{ conversationId: string }> };

/** Без БД: разгоняет chat:typing собеседнику, если вызывающий — участник диалога. */
export async function POST(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`chat-typing:${session.user.id}`, 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: 'Invalid conversationId' }, { status: 400 });

  const result = await chatService().getConversationMeta(session.user.id, parsedParams.data.conversationId);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }

  await publish(result.value.otherUserId, {
    type: 'chat:typing',
    conversationId: parsedParams.data.conversationId,
    userId: session.user.id,
  });
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

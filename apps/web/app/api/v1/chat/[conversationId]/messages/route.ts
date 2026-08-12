import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import { NotFoundError, type ChatMessage } from '@vire/core';
import { chatHistoryCursorSchema, type ChatMessagesResponse } from '@vire/api-contracts';
import { errorJson } from '@/lib/error-response';

const paramsSchema = z.object({ conversationId: z.string().uuid() });
const HISTORY_LIMIT = 50;

type Ctx = { params: Promise<{ conversationId: string }> };

function toResponse(messages: ChatMessage[]): ChatMessagesResponse {
  return { messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })) };
}

export async function GET(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: 'Invalid conversationId' }, { status: 400 });

  const searchParams = new URL(req.url).searchParams;
  const parsedCursor = chatHistoryCursorSchema.safeParse({
    before: searchParams.get('before'),
    beforeId: searchParams.get('beforeId'),
  });
  if (!parsedCursor.success) return NextResponse.json({ error: 'Invalid before' }, { status: 400 });

  const result = await chatService().history(session.user.id, parsedParams.data.conversationId, parsedCursor.data, HISTORY_LIMIT);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json(toResponse(result.value));
}

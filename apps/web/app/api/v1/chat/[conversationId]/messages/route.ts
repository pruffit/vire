import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import { NotFoundError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

const paramsSchema = z.object({ conversationId: z.string().uuid() });
const HISTORY_LIMIT = 50;

type Ctx = { params: Promise<{ conversationId: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: 'Invalid conversationId' }, { status: 400 });

  const searchParams = new URL(req.url).searchParams;
  const beforeRaw = searchParams.get('before');
  const beforeIdRaw = searchParams.get('beforeId');
  let before: { createdAt: Date; id: string } | null = null;
  if (beforeRaw || beforeIdRaw) {
    const parsedId = z.string().uuid().safeParse(beforeIdRaw);
    const parsedDate = beforeRaw ? new Date(beforeRaw) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || !parsedId.success) {
      return NextResponse.json({ error: 'Invalid before' }, { status: 400 });
    }
    before = { createdAt: parsedDate, id: parsedId.data };
  }

  const result = await chatService().history(session.user.id, parsedParams.data.conversationId, before, HISTORY_LIMIT);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ messages: result.value });
}

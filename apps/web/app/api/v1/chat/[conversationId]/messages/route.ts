import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import { NotFoundError } from '@vire/core';

const paramsSchema = z.object({ conversationId: z.string().uuid() });
const HISTORY_LIMIT = 50;

type Ctx = { params: Promise<{ conversationId: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: 'Invalid conversationId' }, { status: 400 });

  const beforeRaw = new URL(req.url).searchParams.get('before');
  let before: Date | null = null;
  if (beforeRaw) {
    const parsedDate = new Date(beforeRaw);
    if (Number.isNaN(parsedDate.getTime())) return NextResponse.json({ error: 'Invalid before' }, { status: 400 });
    before = parsedDate;
  }

  const result = await chatService().history(session.user.id, parsedParams.data.conversationId, before, HISTORY_LIMIT);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: 'Not found' }, { status });
  }
  return NextResponse.json({ messages: result.value });
}

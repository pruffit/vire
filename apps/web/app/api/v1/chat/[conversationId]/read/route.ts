import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import { NotFoundError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

const paramsSchema = z.object({ conversationId: z.string().uuid() });

type Ctx = { params: Promise<{ conversationId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: 'Invalid conversationId' }, { status: 400 });

  const result = await chatService().markRead(session.user.id, parsedParams.data.conversationId);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ ok: true });
}

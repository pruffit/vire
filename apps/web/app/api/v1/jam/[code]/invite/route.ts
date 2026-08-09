import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { jamService } from '@/lib/jam';
import { friendshipService } from '@/lib/friends';
import { notificationService } from '@/lib/notifications';
import { ValidationError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

const schema = z.object({ userId: z.string().uuid() });

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { code } = await params;
  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return errorJson(codeResult.error, status);
  }

  const membership = await service.assertParticipant(codeResult.value.id, { userId: session.user.id });
  if (!membership.ok) return errorJson(membership.error, 403);

  const status = await friendshipService().getStatus(session.user.id, parsed.data.userId);
  if (status !== 'FRIENDS') {
    return NextResponse.json({ error: 'Пригласить можно только друга', code: 'jam.inviteFriendsOnly' }, { status: 403 });
  }

  await notificationService().notify(parsed.data.userId, 'JAM_INVITE', session.user.id, codeResult.value.id);
  return NextResponse.json({ ok: true });
}

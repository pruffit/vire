import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, DrizzlePresaveRepository } from '@vire/db';
import { PresaveService, NotFoundError, type ValidationError } from '@vire/core';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

type Params = { params: Promise<{ releaseId: string }> };

const guestSchema = z.object({ email: z.string().email().max(254) });

function presaveService() {
  return new PresaveService(new DrizzlePresaveRepository(db), { now: () => Date.now() });
}

function presaveErrorResponse(error: NotFoundError | ValidationError): NextResponse {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ error: error.message }, { status: 400 });
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ presaved: false });
  const { releaseId } = await params;
  const result = await presaveService().getState(session.user.id, releaseId);
  return NextResponse.json({ presaved: result.ok ? result.value.presaved : false });
}

export async function POST(req: Request, { params }: Params) {
  const { releaseId } = await params;
  const service = presaveService();
  const session = await auth();

  if (session?.user?.id) {
    const rl = await rateLimit(`presave:${session.user.id}`, 30, 60);
    if (!rl.ok) return tooManyRequests(rl.retryAfter);
    const result = await service.presaveUser(session.user.id, releaseId);
    if (!result.ok) return presaveErrorResponse(result.error);
    return NextResponse.json({ presaved: true });
  }

  // Гость: пресейв по email.
  const body = await req.json().catch(() => ({}));
  const parsed = guestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Нужен корректный email' }, { status: 400 });
  }

  // По IP отдельно от email-лимита: иначе гость спамит чужой ящик, каждый раз указывая новый email.
  const ipRl = await rateLimit(clientKey(req, 'presave-guest-ip'), 20, 3600);
  if (!ipRl.ok) return tooManyRequests(ipRl.retryAfter);

  const email = parsed.data.email.trim().toLowerCase();
  const rl = await rateLimit(`presave-guest:${email}`, 10, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  const result = await service.presaveGuest(email, releaseId);
  if (!result.ok) return presaveErrorResponse(result.error);
  return NextResponse.json({ presaved: true, guest: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { releaseId } = await params;
  await presaveService().unpresave(session.user.id, releaseId);
  return NextResponse.json({ presaved: false });
}

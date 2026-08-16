import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaller } from '@/lib/caller';
import { db, DrizzlePresaveRepository } from '@vire/db';
import { PresaveService, NotFoundError, type ValidationError } from '@vire/core';
import type { PresaveResponse } from '@vire/api-contracts';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ releaseId: string }> };

const guestSchema = z.object({ email: z.string().email().max(254) });

function presaveService() {
  return new PresaveService(new DrizzlePresaveRepository(db), { now: () => Date.now() });
}

function presaveErrorResponse(error: NotFoundError | ValidationError): NextResponse {
  if (error instanceof NotFoundError) {
    return errorJson(error, 404);
  }
  return errorJson(error, 400);
}

export async function GET(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ presaved: false } satisfies PresaveResponse);
  const { releaseId } = await params;
  const result = await presaveService().getState(caller.id, releaseId);
  return NextResponse.json({ presaved: result.ok ? result.value.presaved : false } satisfies PresaveResponse);
}

export async function POST(req: Request, { params }: Params) {
  const { releaseId } = await params;
  const service = presaveService();
  const caller = await getCaller();

  if (caller?.id) {
    const rl = await rateLimit(`presave:${caller.id}`, 30, 60);
    if (!rl.ok) return tooManyRequests(rl.retryAfter);
    const result = await service.presaveUser(caller.id, releaseId);
    if (!result.ok) return presaveErrorResponse(result.error);
    return NextResponse.json({ presaved: true } satisfies PresaveResponse);
  }

  // Гость: пресейв по email.
  const body = await req.json().catch(() => ({}));
  const parsed = guestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Нужен корректный email', code: 'presave.invalidEmail' }, { status: 400 });
  }

  // По IP отдельно от email-лимита: иначе гость спамит чужой ящик, каждый раз указывая новый email.
  const ipRl = await rateLimit(clientKey(req, 'presave-guest-ip'), 20, 3600);
  if (!ipRl.ok) return tooManyRequests(ipRl.retryAfter);

  const email = parsed.data.email.trim().toLowerCase();
  const rl = await rateLimit(`presave-guest:${email}`, 10, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  const result = await service.presaveGuest(email, releaseId);
  if (!result.ok) return presaveErrorResponse(result.error);
  return NextResponse.json({ presaved: true, guest: true } satisfies PresaveResponse);
}

export async function DELETE(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { releaseId } = await params;
  await presaveService().unpresave(caller.id, releaseId);
  return NextResponse.json({ presaved: false } satisfies PresaveResponse);
}

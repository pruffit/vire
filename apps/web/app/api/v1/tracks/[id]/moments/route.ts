import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, DrizzleListenerTrackRepository } from '@vire/db';
import { ListenerTrackService, NotFoundError } from '@vire/core';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

const momentSchema = z.object({
  positionSec: z.number().int().min(0).max(86400),
});

function listenerTrackService() {
  return new ListenerTrackService(new DrizzleListenerTrackRepository(db));
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const result = await listenerTrackService().getMoments(id);
  if (!result.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ moments: result.value });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  // Анонимный INSERT без дедупликации: без лимита агрегат «любимых моментов»
  // накручивается скриптом, а таблица раздувается.
  const rl = await rateLimit(clientKey(req, 'moments'), 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await req.json().catch(() => null);
  const parsed = momentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const session = await auth();
  const result = await listenerTrackService().addMoment(id, parsed.data.positionSec, session?.user?.id ?? null);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jamService } from '@/lib/jam';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { SESSION_ID_MAX_LEN } from '@/lib/session-signing';
import { ForbiddenError, ConflictError, ValidationError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

const schema = z.object({
  sessionId: z.string().max(SESSION_ID_MAX_LEN).optional(),
});

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const identity = await resolveJamIdentity(parsed.data.sessionId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return errorJson(codeResult.error, status);
  }

  // Ключ по джему, не по участнику — добор общий, один за всю опустевшую очередь.
  const limit = await rateLimit(`jam-refill:${codeResult.value.id}`, 5, 60);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const result = await service.refillFromWave(codeResult.value.id, identity);
  if (!result.ok) {
    const status =
      result.error instanceof ForbiddenError ? 403 : result.error instanceof ConflictError ? 409 : result.error instanceof ValidationError ? 400 : 404;
    return errorJson(result.error, status);
  }
  return NextResponse.json(result.value);
}

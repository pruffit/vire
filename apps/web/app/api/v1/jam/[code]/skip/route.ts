import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jamService } from '@/lib/jam';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { SESSION_ID_MAX_LEN } from '@/lib/session-signing';
import { ForbiddenError, ConflictError, ValidationError } from '@vire/core';

const schema = z.object({
  itemId: z.string().uuid(),
  sessionId: z.string().max(SESSION_ID_MAX_LEN).optional(),
});

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const identity = await resolveJamIdentity(parsed.data.sessionId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rlKey = 'userId' in identity ? identity.userId : identity.guestSessionId;
  const limit = await rateLimit(`jam-skip:${rlKey}`, 20, 60);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return NextResponse.json({ error: codeResult.error.message }, { status });
  }

  const result = await service.voteSkip(codeResult.value.id, identity, parsed.data.itemId);
  if (!result.ok) {
    const status =
      result.error instanceof ForbiddenError ? 403 : result.error instanceof ConflictError ? 409 : result.error instanceof ValidationError ? 400 : 404;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(result.value);
}

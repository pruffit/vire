import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jamService } from '@/lib/jam';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import { SESSION_ID_MAX_LEN } from '@/lib/session-signing';
import { NotFoundError, ConflictError } from '@vire/core';

const schema = z.object({
  displayName: z.string().trim().min(1).max(80),
  sessionId: z.string().max(SESSION_ID_MAX_LEN).optional(),
});

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const rl = await rateLimit(clientKey(req, 'jam-join'), 20, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { code } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const identity = await resolveJamIdentity(parsed.data.sessionId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await jamService().join(code, identity, parsed.data.displayName);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : result.error instanceof ConflictError ? 409 : 400;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(result.value);
}

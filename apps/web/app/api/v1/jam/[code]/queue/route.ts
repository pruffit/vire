import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jamService } from '@/lib/jam';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { SESSION_ID_MAX_LEN } from '@/lib/session-signing';
import { ForbiddenError, ConflictError, ValidationError } from '@vire/core';

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add'), trackId: z.string().uuid(), sessionId: z.string().max(SESSION_ID_MAX_LEN).optional() }),
  z.object({ kind: z.literal('remove'), itemId: z.string().uuid(), sessionId: z.string().max(SESSION_ID_MAX_LEN).optional() }),
  z.object({
    kind: z.literal('move'),
    itemId: z.string().uuid(),
    toPosition: z.number().int().min(0),
    sessionId: z.string().max(SESSION_ID_MAX_LEN).optional(),
  }),
]);

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const identity = await resolveJamIdentity(parsed.data.sessionId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return NextResponse.json({ error: codeResult.error.message }, { status });
  }

  const { sessionId: _sessionId, ...intent } = parsed.data;
  const result = await service.mutateQueue(codeResult.value.id, identity, intent);
  if (!result.ok) {
    const status = result.error instanceof ForbiddenError ? 403 : result.error instanceof ConflictError ? 409 : 404;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(result.value);
}

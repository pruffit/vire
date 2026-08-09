import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jamService } from '@/lib/jam';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { SESSION_ID_MAX_LEN } from '@/lib/session-signing';
import { ValidationError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

const schema = z.object({ sessionId: z.string().max(SESSION_ID_MAX_LEN).optional() });

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const identity = await resolveJamIdentity(parsed.data.sessionId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return errorJson(codeResult.error, status);
  }

  const result = await service.heartbeat(codeResult.value.id, identity);
  if (!result.ok) return errorJson(result.error, 403);
  return NextResponse.json({ ok: true });
}

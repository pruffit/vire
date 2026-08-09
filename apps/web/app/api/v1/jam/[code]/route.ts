import { NextResponse } from 'next/server';
import { jamService } from '@/lib/jam';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { ForbiddenError, ValidationError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { code } = await params;
  const sessionId = new URL(req.url).searchParams.get('sessionId') ?? undefined;
  const identity = await resolveJamIdentity(sessionId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return errorJson(codeResult.error, status);
  }

  const result = await service.getState(codeResult.value.id, identity);
  if (!result.ok) {
    const status = result.error instanceof ForbiddenError ? 403 : 404;
    return errorJson(result.error, status);
  }
  return NextResponse.json(result.value);
}

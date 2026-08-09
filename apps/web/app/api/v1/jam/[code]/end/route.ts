import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { jamService } from '@/lib/jam';
import { ForbiddenError, ValidationError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

type Ctx = { params: Promise<{ code: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await params;
  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return errorJson(codeResult.error, status);
  }

  const result = await service.endJam(codeResult.value.id, session.user.id);
  if (!result.ok) {
    const status = result.error instanceof ForbiddenError ? 403 : 404;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ ok: true });
}

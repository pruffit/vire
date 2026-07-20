import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { jamService } from '@/lib/jam';
import { ForbiddenError, ConflictError, ValidationError } from '@vire/core';

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('play'), trackId: z.string().uuid(), positionMs: z.number().min(0) }),
  z.object({ kind: z.literal('pause'), positionMs: z.number().min(0) }),
  z.object({ kind: z.literal('seek'), positionMs: z.number().min(0) }),
  z.object({ kind: z.literal('track'), trackId: z.string().uuid() }),
]);

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return NextResponse.json({ error: codeResult.error.message }, { status });
  }

  const result = await service.setPlayback(codeResult.value.id, session.user.id, parsed.data);
  if (!result.ok) {
    const status = result.error instanceof ForbiddenError ? 403 : result.error instanceof ConflictError ? 409 : 404;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(result.value);
}

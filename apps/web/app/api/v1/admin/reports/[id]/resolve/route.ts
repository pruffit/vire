import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAccess } from '@/lib/require-access';
import { reportService } from '@/lib/reports';
import { NotFoundError } from '@vire/core';

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ status: z.enum(['REVIEWED', 'DISMISSED']) });
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const access = await requireAccess('admin.content.moderate');
  if (!access.ok) return access.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(json);
  if (!parsedBody.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await reportService().resolve(parsedParams.data.id, access.actor.id, parsedBody.data.status);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  await access.audit('report.resolve', { type: 'report', id: parsedParams.data.id }, { status: parsedBody.data.status });
  return NextResponse.json({ ok: true });
}

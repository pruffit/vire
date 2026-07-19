import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { reportService } from '@/lib/reports';
import { NotFoundError } from '@vire/core';

const MODERATOR_ROLES = new Set(['MODERATOR', 'ADMIN', 'SUPERADMIN']);

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ status: z.enum(['REVIEWED', 'DISMISSED']) });
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || !role || !MODERATOR_ROLES.has(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(json);
  if (!parsedBody.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await reportService().resolve(parsedParams.data.id, session.user.id, parsedBody.data.status);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}

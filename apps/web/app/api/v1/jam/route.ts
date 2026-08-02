import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { jamService } from '@/lib/jam';
import { ConflictError } from '@vire/core';

const schema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  mode: z.enum(['SYNCED', 'SPEAKER']).optional(),
  kind: z.enum(['JAM', 'PARTY']).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await jamService().create(
    session.user.id,
    parsed.data.title ?? null,
    session.user.name ?? 'Хост',
    parsed.data.mode ?? 'SYNCED',
    parsed.data.kind ?? 'JAM',
  );
  if (!result.ok) {
    const status = result.error instanceof ConflictError ? 409 : 500;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json({ code: result.value.code, jamId: result.value.id });
}

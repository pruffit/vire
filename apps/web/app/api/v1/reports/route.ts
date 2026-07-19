import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { reportService } from '@/lib/reports';
import { ValidationError } from '@vire/core';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

const schema = z.object({
  targetType: z.enum(['USER', 'MESSAGE']),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`report:${session.user.id}`, 5, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await reportService().submit(
    session.user.id,
    parsed.data.targetType,
    parsed.data.targetId,
    parsed.data.reason,
  );
  if (!result.ok) {
    const status = result.error instanceof ValidationError ? 422 : 409;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(result.value);
}

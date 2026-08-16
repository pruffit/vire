import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaller } from '@/lib/caller';
import { reportService } from '@/lib/reports';
import { ValidationError } from '@vire/core';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

const schema = z.object({
  targetType: z.enum(['USER', 'MESSAGE']),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`report:${caller.id}`, 5, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await reportService().submit(
    caller.id,
    parsed.data.targetType,
    parsed.data.targetId,
    parsed.data.reason,
  );
  if (!result.ok) {
    const status = result.error instanceof ValidationError ? 422 : 409;
    return errorJson(result.error, status);
  }
  return NextResponse.json(result.value);
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaller } from '@/lib/caller';
import { blockService } from '@/lib/blocks';
import { playlistService } from '@/lib/playlist';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

const paramsSchema = z.object({ userId: z.string().uuid() });
type Ctx = { params: Promise<{ userId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`block:${caller.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

  const result = await blockService().block(caller.id, parsed.data.userId);
  if (!result.ok) return errorJson(result.error, 422);

  // Блокировка отбирает и совместный доступ: иначе заблокированный остаётся редактором плейлиста.
  // Ошибка здесь — 500 намеренно: повтор блокировки идемпотентен и доведёт очистку.
  await playlistService().removeMembershipBetween(caller.id, parsed.data.userId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

  await blockService().unblock(caller.id, parsed.data.userId);
  return NextResponse.json({ ok: true });
}

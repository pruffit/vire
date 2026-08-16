import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaller } from '@/lib/caller';
import { startLink } from '@/lib/link-session';
import { publish } from '@/lib/realtime';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ commit: z.string().regex(/^[A-Za-z0-9+/]{43}=$/) });

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`link-start:${caller.id}`, 10, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid commit' }, { status: 400 });

  const linkId = await startLink(caller.id, parsed.data.commit);
  if (!linkId) return NextResponse.json({ error: 'Link unavailable' }, { status: 503 });

  await publish(caller.id, { type: 'link-request', linkId });
  return NextResponse.json({ linkId });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { externalResolveService } from '@/lib/external';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

const DEFAULT_LIMIT = 8;
const schema = z.object({ q: z.string().min(1).max(200) });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({ q: searchParams.get('q') ?? '' });
  if (!parsed.success) return NextResponse.json({ candidates: [] });

  const identity = await resolveJamIdentity(searchParams.get('sessionId') ?? undefined);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rlKey = 'userId' in identity ? identity.userId : identity.guestSessionId;
  const limit = await rateLimit(`party-suggest:${rlKey}`, 30, 60);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const candidates = await externalResolveService().suggest(parsed.data.q, DEFAULT_LIMIT);
  return NextResponse.json({ candidates });
}

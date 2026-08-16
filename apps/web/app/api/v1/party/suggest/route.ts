import { NextResponse } from 'next/server';
import { z } from 'zod';
import { externalResolveService } from '@/lib/external';
import { tasteSuggestions } from '@/lib/external/taste-suggestions';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import type { PartySuggestResponse } from '@vire/api-contracts';

const DEFAULT_LIMIT = 8;
const schema = z.object({ q: z.string().max(200).optional() });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({ q: searchParams.get('q') ?? undefined });
  if (!parsed.success) return NextResponse.json({ candidates: [] } satisfies PartySuggestResponse);

  const identity = await resolveJamIdentity(searchParams.get('sessionId') ?? undefined);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rlKey = 'userId' in identity ? identity.userId : identity.guestSessionId;
  const limit = await rateLimit(`party-suggest:${rlKey}`, 30, 60);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const q = parsed.data.q?.trim();
  if (!q) {
    const candidates = 'userId' in identity ? await tasteSuggestions(identity.userId, DEFAULT_LIMIT) : [];
    return NextResponse.json({ candidates } satisfies PartySuggestResponse);
  }

  const candidates = await externalResolveService().suggest(q, DEFAULT_LIMIT);
  return NextResponse.json({ candidates } satisfies PartySuggestResponse);
}

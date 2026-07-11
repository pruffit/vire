import { NextResponse } from 'next/server';
import { searchAll } from '@vire/db';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const rl = await rateLimit(clientKey(req, 'search'), 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json({ artists: [], releases: [], tracks: [] });
  }

  const results = await searchAll(q, 4);
  return NextResponse.json(results);
}

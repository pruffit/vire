import { NextResponse } from 'next/server';
import { db, DrizzleSearchRepository } from '@vire/db';
import { SearchService } from '@vire/core';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const rl = await rateLimit(clientKey(req, 'search'), 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';

  const service = new SearchService(new DrizzleSearchRepository(db));
  const result = await service.search(q, 4);
  return NextResponse.json(result.ok ? result.value : { artists: [], releases: [], tracks: [] });
}

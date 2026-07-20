import { NextResponse } from 'next/server';
import { db, DrizzleSearchRepository } from '@vire/db';
import { SearchService } from '@vire/core';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 20;

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_LIMIT) : DEFAULT_LIMIT;
}

export async function GET(req: Request) {
  const rl = await rateLimit(clientKey(req, 'search'), 60, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const limit = parseLimit(searchParams.get('limit'));

  const service = new SearchService(new DrizzleSearchRepository(db));
  const result = await service.search(q, limit);
  return NextResponse.json(result.ok ? result.value : { artists: [], releases: [], tracks: [] });
}

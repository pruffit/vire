import { getRedis } from './redis';

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
}

/** Fixed-window rate limiter via Redis counter; degrades to ok=true when Redis is unavailable. */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  try {
    const redis = getRedis();
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }
    const ok = count <= limit;
    return { ok, remaining: Math.max(0, limit - count), retryAfter: ok ? 0 : windowSec };
  } catch {
    return { ok: true, remaining: 1, retryAfter: 0 };
  }
}

export function clientKey(req: Request, prefix: string): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  return `${prefix}:${ip}`;
}

export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    },
  );
}

import { type NextRequest } from 'next/server';
import { handlers } from '@/auth';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

export const GET = handlers.GET;

// Wrap POST with a rate limit to protect sign-in/magic-link from brute force.
// 10 attempts per minute per IP is generous for legitimate use.
export async function POST(req: NextRequest) {
  const rl = await rateLimit(clientKey(req, 'auth'), 10, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  return handlers.POST(req);
}

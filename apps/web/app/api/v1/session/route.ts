import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { signSessionId } from '@/lib/session-signing';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import type { SessionResponse } from '@vire/api-contracts';

// HMAC-подписанный sessionId для presence; id генерится ТОЛЬКО на сервере —
// подпись произвольного клиентского id обесценила бы её (накрутка со случайными id)
export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'session'), 20, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const sessionId = signSessionId(randomUUID());
  return NextResponse.json({ sessionId } satisfies SessionResponse);
}

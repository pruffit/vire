import { NextResponse } from 'next/server';
import { recordSitePresence } from '@/lib/presence';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import { verifySessionId, SESSION_ID_MAX_LEN } from '@/lib/session-signing';
import type { PresenceResponse } from '@vire/api-contracts';

/**
 * Heartbeat присутствия на сайте (шлёт SitePresence из layout с любой страницы).
 * Анонимно — авторизация не требуется. Деградирует тихо при сбое Redis.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'presence'), 12, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let raw: unknown;
  try {
    ({ sessionId: raw } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof raw !== 'string' || raw.length < 8 || raw.length > SESSION_ID_MAX_LEN) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }
  const sessionId = verifySessionId(raw);
  if (!sessionId) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }
  try {
    const online = await recordSitePresence(sessionId);
    return NextResponse.json({ online } satisfies PresenceResponse);
  } catch {
    return NextResponse.json({ online: 0 } satisfies PresenceResponse);
  }
}

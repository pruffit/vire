import { NextResponse } from 'next/server';
import { recordSitePresence } from '@/lib/presence';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

/**
 * Heartbeat присутствия на сайте (шлёт SitePresence из layout с любой страницы).
 * Анонимно — авторизация не требуется. Деградирует тихо при сбое Redis.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'presence'), 12, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let sessionId: unknown;
  try {
    ({ sessionId } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 100) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }
  try {
    const online = await recordSitePresence(sessionId);
    return NextResponse.json({ online });
  } catch {
    return NextResponse.json({ online: 0 });
  }
}

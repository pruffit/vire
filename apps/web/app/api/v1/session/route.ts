import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { signSessionId } from '@/lib/session-signing';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

/**
 * Выдаёт свежий sessionId для присутствия (heartbeat плеера/сайта), подписанный
 * HMAC. Id генерится на сервере (не принимает вход от клиента) — иначе подпись
 * ничего не даёт: если бы сервер подписывал произвольный клиентский id по
 * запросу, накрутка просто дергала бы этот эндпоинт в цикле со случайными id.
 * Клиент кэширует ответ на вкладку (sessionStorage), так что дергается один раз.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'session'), 20, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const sessionId = signSessionId(randomUUID());
  return NextResponse.json({ sessionId });
}

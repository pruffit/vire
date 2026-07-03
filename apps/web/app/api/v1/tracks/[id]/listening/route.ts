import { NextResponse } from 'next/server';
import { recordListening, countListening } from '@/lib/presence';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

/** Heartbeat играющего клиента: записывает присутствие, возвращает счётчик. */
export async function POST(req: Request, { params }: Params) {
  const rl = await rateLimit(clientKey(req, 'listening'), 12, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id: trackId } = await params;

  const body = await req.json().catch(() => null);
  const sessionId = (body as { sessionId?: unknown } | null)?.sessionId;
  if (typeof sessionId !== 'string' || sessionId.length < 1 || sessionId.length > 64) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    const count = await recordListening(trackId, sessionId);
    return NextResponse.json({ count });
  } catch {
    // Redis недоступен — не роняем воспроизведение, просто 0.
    return NextResponse.json({ count: 0 });
  }
}

/** Текущее число слушателей трека (для отображения, без записи). */
export async function GET(req: Request, { params }: Params) {
  const rl = await rateLimit(clientKey(req, 'listening'), 12, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id: trackId } = await params;
  try {
    const count = await countListening(trackId);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

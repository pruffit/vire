import { NextResponse } from 'next/server';
import { ping } from '@vire/db';
import { pingRedis } from '@/lib/presence';

// Healthcheck контейнера. БД критична → 503 при недоступности.
// Redis репортим, но не валим проверку: presence/rate-limit деградируют штатно.
export async function GET() {
  const [redisLatency] = await Promise.all([pingRedis().catch(() => null)]);
  const redis = redisLatency !== null ? 'connected' : 'disconnected';

  try {
    await ping();
    return NextResponse.json({ status: 'ok', db: 'connected', redis });
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'disconnected', redis },
      { status: 503 },
    );
  }
}

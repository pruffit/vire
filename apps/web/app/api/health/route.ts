import { NextResponse } from 'next/server';
import { pingDb } from '@vire/db';
import { pingRedis } from '@/lib/presence';
import { SITE_VERSION } from '@/lib/site';

export const dynamic = 'force-dynamic';

// публичный health для внешнего uptime-чека — 200 всё живо, 503 БД/Redis недоступны
export async function GET() {
  // pingDb/pingRedis возвращают number|null (null = недоступно).
  const [dbPing, redisPing] = await Promise.all([
    pingDb().catch(() => null),
    pingRedis().catch(() => null),
  ]);
  const dbOk = dbPing !== null;
  const redisOk = redisPing !== null;
  const ok = dbOk && redisOk;
  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', db: dbOk, redis: redisOk, version: SITE_VERSION, ts: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}

import { NextResponse } from 'next/server';
import { pingDb } from '@vire/db';
import { pingRedis } from '@/lib/presence';
import { SITE_VERSION } from '@/lib/site';

export const dynamic = 'force-dynamic';

// Публичный health-эндпоинт для внешнего uptime-чека (UptimeRobot и т.п.).
// 200 — всё живо; 503 — деградация (БД или Redis недоступны).
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

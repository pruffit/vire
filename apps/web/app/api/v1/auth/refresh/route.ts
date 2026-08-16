import { NextResponse } from 'next/server';
import { deviceAuthService } from '@/lib/device-auth';
import { clearDeviceStateCache } from '@/lib/caller';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';
import { refreshRequestSchema, type TokenPairResponse } from '@vire/api-contracts';

/** Обмен refresh на новую пару. Старый refresh перестаёт действовать сразу. */
export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'device-refresh'), 30, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const parsed = refreshRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await deviceAuthService().refresh({ refreshToken: parsed.data.refreshToken });
  if (!result.ok) {
    // Массовый отзыв по подозрению на утечку должен подействовать немедленно.
    clearDeviceStateCache();
    return errorJson(result.error, 401);
  }

  return NextResponse.json(result.value satisfies TokenPairResponse, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

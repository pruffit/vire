import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { deviceAuthService } from '@/lib/device-auth';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';
import {
  registerDeviceRequestSchema,
  type DevicesResponse,
  type TokenPairResponse,
  type DeviceDTO,
} from '@vire/api-contracts';

/** Список активных устройств владельца. */
export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const devices = await deviceAuthService().list(caller.id);
  const body: DevicesResponse = {
    devices: devices.map((d): DeviceDTO => ({
      id: d.id,
      name: d.name,
      platform: d.platform as DeviceDTO['platform'],
      createdAt: d.createdAt.toISOString(),
      lastUsedAt: d.lastUsedAt.toISOString(),
      current: d.id === caller.deviceId,
    })),
  };
  return NextResponse.json(body);
}

/**
 * Обмен доказанной личности на пару токенов устройства. Сознательно принимает только
 * cookie-сессию: пароль здесь не проверяется, второй поверхности брутфорса не появляется.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'device-register'), 10, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.source !== 'session') {
    return NextResponse.json({ error: 'Session required' }, { status: 403 });
  }

  const parsed = registerDeviceRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await deviceAuthService().register({
    userId: caller.id,
    role: caller.role,
    name: parsed.data.name,
    platform: parsed.data.platform,
  });
  if (!result.ok) return errorJson(result.error, 400);

  return NextResponse.json(result.value satisfies TokenPairResponse, {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  });
}

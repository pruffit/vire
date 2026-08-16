import { headers } from 'next/headers';
import { auth } from '@/auth';
import { createTtlCache } from '@vire/core';
import { bearerFromHeader, verifyAccessToken } from '@vire/core/identity/device-tokens';
import { DrizzleDeviceRepository } from '@vire/db';
import { getSigningSecret } from '@/lib/app-secret';
import type { Actor } from '@vire/core/access';
import type { UserRole } from '@vire/db';

export type CallerSource = 'session' | 'device';

export interface Caller extends Actor {
  name: string | null;
  email: string | null;
  image: string | null;
  /** Чем аутентифицирован вызов. */
  source: CallerSource;
  /** Устройство, выдавшее токен; null для cookie-сессии. */
  deviceId: string | null;
}

/** Отзыв устройства должен действовать быстрее, чем истекает access (15 мин). */
export const DEVICE_STATE_TTL_MS = 30_000;

const deviceState = createTtlCache<string, { revoked: boolean; userId: string } | null>({
  ttlMs: DEVICE_STATE_TTL_MS,
  maxSize: 500,
});

/** Вне request scope (server-side рендер вне запроса, прямой вызов хендлера) заголовков нет. */
async function authorizationHeader(): Promise<string | null> {
  try {
    return (await headers()).get('authorization');
  } catch {
    return null;
  }
}

async function callerFromBearer(token: string): Promise<Caller | null> {
  const secret = getSigningSecret();
  // Без секрета проверить подпись нечем — токен не принимаем (fail-closed).
  if (!secret) return null;

  const verified = verifyAccessToken(secret, token, Date.now());
  if (!verified.ok) return null;

  const { sub, role, did } = verified.value;
  // Подпись доказывает выдачу, но не то, что устройство ещё живо: отзыв проверяем в БД.
  const state = await deviceState.get(did, async () => {
    const device = await new DrizzleDeviceRepository().findById(did);
    if (!device) return null;
    return { revoked: device.revokedAt !== null, userId: device.userId };
  }).catch(() => null);

  if (!state || state.revoked || state.userId !== sub) return null;

  return {
    id: sub,
    role: role as UserRole,
    name: null,
    email: null,
    image: null,
    source: 'device',
    deviceId: did,
  };
}

/**
 * Единственная точка получения актора для серверного кода: cookie-сессия Auth.js
 * или Bearer-токен устройства. Потребители не знают, чем именно доказана личность.
 */
export async function getCaller(): Promise<Caller | null> {
  const bearer = bearerFromHeader(await authorizationHeader());
  if (bearer) return callerFromBearer(bearer);

  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  return {
    id: user.id,
    role: user.role,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    source: 'session',
    deviceId: null,
  };
}

/** Сброс кэша состояния устройств — вызывается после отзыва, чтобы он подействовал сразу. */
export function clearDeviceStateCache(): void {
  deviceState.clear();
}

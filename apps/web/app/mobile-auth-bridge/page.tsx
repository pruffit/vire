import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCaller } from '@/lib/caller';
import { deviceAuthService } from '@/lib/device-auth';
import { rateLimit } from '@/lib/rate-limit';
import { DEVICE_PLATFORMS, type RegisterDeviceRequest } from '@vire/api-contracts';

function resolvePlatform(value: string | undefined): RegisterDeviceRequest['platform'] {
  return (DEVICE_PLATFORMS as readonly string[]).includes(value ?? '')
    ? (value as RegisterDeviceRequest['platform'])
    : 'other';
}

async function bridgeRateLimitKey(): Promise<string> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
  return `device-register:${ip}`;
}

/**
 * Веб-мост входа для мобильного приложения: `expo-web-browser` открывает эту страницу в
 * системном браузере на доказанной cookie-сессии и получает пару токенов редиректом на
 * `vire://auth-callback`. Тот же core-сервис, что `POST /api/v1/auth/devices`
 * (docs/features/device-auth.md) — не отдельная реализация выдачи токенов.
 */
export default async function MobileAuthBridgePage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; name?: string }>;
}) {
  const caller = await getCaller();
  if (!caller || caller.source !== 'session') {
    redirect('/sign-in?callbackUrl=/mobile-auth-bridge');
  }

  const rl = await rateLimit(await bridgeRateLimitKey(), 10, 3600);
  if (!rl.ok) {
    return (
      <p style={{ padding: 24, fontFamily: 'sans-serif' }}>
        Слишком много попыток входа. Попробуйте позже.
      </p>
    );
  }

  const { platform, name } = await searchParams;
  const result = await deviceAuthService().register({
    userId: caller.id,
    role: caller.role,
    name: name?.trim().slice(0, 80) || 'Мобильное приложение',
    platform: resolvePlatform(platform),
  });

  if (!result.ok) {
    return (
      <p style={{ padding: 24, fontFamily: 'sans-serif' }}>
        Не удалось выполнить вход. Закройте окно и попробуйте снова из приложения.
      </p>
    );
  }

  const { accessToken, refreshToken, deviceId } = result.value;
  const callback = new URL('vire://auth-callback');
  callback.searchParams.set('accessToken', accessToken);
  callback.searchParams.set('refreshToken', refreshToken);
  callback.searchParams.set('deviceId', deviceId);

  redirect(callback.toString());
}

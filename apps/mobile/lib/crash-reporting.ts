import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

/**
 * Отчёты о падениях. DSN живёт в `app.json` → `extra.sentryDsn` (публичный ключ, не секрет,
 * поэтому в git), а не в `.env`: `.env` вне репозитория, и сборка с ним невоспроизводима.
 *
 * Приёмник — **свой**, `apps/web/app/api/1/envelope`: sentry.io отдаёт 403 на любой запрос
 * из России. SDK при этом стоковый — из DSN он сам выводит `/api/<projectId>/envelope/`,
 * поэтому переезд на self-hosted GlitchTip позже потребует только смены хоста.
 *
 * Пустой DSN — легитимное состояние: SDK не инициализируется, приложение работает как
 * раньше. Так репозиторий остаётся собираемым, даже если приёмник ещё не раскатан.
 */
/** Override для разработки — тем же приёмом, что базовый URL (`lib/base-url.ts`). */
function resolveDsn(): string | undefined {
  const explicit = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (explicit) return explicit;
  return (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn?.trim();
}

export function initCrashReporting(): void {
  const dsn = resolveDsn();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    // Нужны падения, а не трассировка производительности: телефон в дороге, трафик платный.
    tracesSampleRate: 0,
    // В приложении есть токены устройства и E2EE-переписка — ничего лишнего наружу.
    sendDefaultPii: false,
    // Свой приёмник хранит только события. Сессии и «здоровье релиза» он осознанно
    // не считает — незачем гонять трафик ради того, что никто не читает.
    enableAutoSessionTracking: false,
  });
}

export function isCrashReportingEnabled(): boolean {
  return Boolean(resolveDsn());
}

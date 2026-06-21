// Sentry для воркера: ловит исключения джоб/процесса с полным стектрейсом рядом с
// Telegram-алертами (которые дают лишь факт ошибки). DSN-gated: без SENTRY_DSN
// init не вызывается, captureWorkerException — no-op. Никогда не бросает.
import * as Sentry from '@sentry/node';

let enabled = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // npm_package_version выставляет pnpm/npm при запуске скрипта — версия воркера.
    release: process.env.npm_package_version,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
  enabled = true;
}

/** Отправляет исключение в Sentry с тегами/контекстом. Безопасно при выключенном Sentry. */
export function captureWorkerException(err: Error, context: Record<string, unknown> = {}): void {
  if (!enabled) return;
  try {
    Sentry.captureException(err, { tags: { service: 'worker' }, extra: context });
  } catch {
    // трекинг не должен ронять воркер
  }
}

/**
 * Дожидается доставки буферизованных событий перед process.exit (на крэше).
 * Без флаша событие теряется, т.к. транспорт асинхронный. No-op без Sentry.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // не блокируем выход воркера
  }
}

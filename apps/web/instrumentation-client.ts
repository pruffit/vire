// Клиентский Sentry — ловит JS-ошибки в браузере у реальных юзеров (раньше их не
// ловил никто; серверный onRequestError видит только серверные). DSN-gated: без
// NEXT_PUBLIC_SENTRY_DSN init не вызывается → полный no-op, ничего не шлётся.
// Файл автоматически подхватывается Next.js (instrumentation-client).
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERSION,
    // Трейсинг — небольшая выборка, чтобы не жечь квоту на старте.
    tracesSampleRate: 0.1,
    // PII не шлём (email/ip) — приватность.
    sendDefaultPii: false,
  });
}

// Инструментирование переходов App Router (Next 15.3+/16). Безопасно и при
// выключенном Sentry — внутри сам проверяет, инициализирован ли клиент.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

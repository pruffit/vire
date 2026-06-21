// Серверная инструментация Next.js. Две задачи:
// 1) register() — инициализирует серверный Sentry (DSN-gated, no-op без SENTRY_DSN);
// 2) onRequestError — ловит необработанные серверные ошибки роутов и шлёт их в
//    captureError (лог + Telegram/webhook-алерт, как и раньше) И в Sentry.
export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // Инициализируем только в Node-рантайме (не в edge/proxy) — там работают роуты/RSC.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_VERSION,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}

// request содержит headers (нужны Sentry.captureRequestError); context — routePath/
// routerKind/renderSource и т.п. от Next. Берём типы из @sentry/nextjs, чтобы
// сигнатура совпадала с captureRequestError.
type RequestInfo = Parameters<typeof import('@sentry/nextjs').captureRequestError>[1];
type ErrorContext = Parameters<typeof import('@sentry/nextjs').captureRequestError>[2];

export async function onRequestError(
  error: unknown,
  request: RequestInfo,
  context: ErrorContext,
): Promise<void> {
  // Существующий путь — лог + Telegram/webhook-алерт (факт ошибки).
  const { captureError } = await import('@/lib/observability');
  await captureError(error, {
    where: `${request.method} ${request.path}`,
    routePath: context.routePath,
    routerKind: context.routerKind,
  });

  // Sentry — детальный стектрейс/группировка (no-op, если не инициализирован).
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(error, request, context);
}

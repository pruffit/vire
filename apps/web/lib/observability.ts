// Лёгкий трекинг ошибок без внешних зависимостей: структурированный лог в stderr
// + опциональный POST на ALERT_WEBHOOK_URL (Telegram-бот через прокси, Discord,
// Slack, Sentry-webhook — любой консьюмер). Алерты не должны бросать в вызывающий код.

interface ErrorContext {
  service?: 'web' | 'worker';
  where?: string;
  [key: string]: unknown;
}

// Анти-шторм: один и тот же текст алерта шлём не чаще раза в 60с на процесс.
const lastSent = new Map<string, number>();
const THROTTLE_MS = 60_000;

export async function captureError(error: unknown, ctx: ErrorContext = {}): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const service = ctx.service ?? 'web';

  console.error(JSON.stringify({
    level: 'error', service, message, ...stripService(ctx), ts: new Date().toISOString(),
  }));

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  const text = `🔴 [${service}] ${ctx.where ?? 'error'}: ${message}`;
  const now = Date.now();
  const prev = lastSent.get(text);
  if (prev && now - prev < THROTTLE_MS) return;
  lastSent.set(text, now);

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // text — для Slack, content — для Discord, остальное — для прочих консьюмеров.
      body: JSON.stringify({
        text, content: text, level: 'error', service,
        where: ctx.where, message, stack: stack?.slice(0, 2000), ts: now,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // алертинг падать молча — он не должен ломать основной поток
  }
}

function stripService(ctx: ErrorContext): Record<string, unknown> {
  const { service: _service, ...rest } = ctx;
  return rest;
}

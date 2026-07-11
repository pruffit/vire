// Алерты воркера: структурированный лог + Telegram/webhook (факт ошибки).
// Алертинг не бросает исключений в воркер.
import { createThrottleGate } from '@vire/core';

const alertGate = createThrottleGate({ ttlMs: 60_000, maxSize: 500 });

// Одинаковый текст — не чаще раза в TTL на процесс, решение принимается один раз,
// до веера по каналам (Telegram/webhook, оба опциональны). Никогда не бросает.
async function dispatch(text: string, fields: Record<string, unknown>): Promise<void> {
  const now = Date.now();
  if (!alertGate.shouldPass(text, now)) return;

  await Promise.all([sendTelegram(text), sendWebhook(text, fields, now)]);
}

async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // no-op
  }
}

async function sendWebhook(text: string, fields: Record<string, unknown>, now: number): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // text — для Slack, content — для Discord, остальное — для прочих консьюмеров.
      body: JSON.stringify({ text, content: text, ...fields, ts: now }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // no-op
  }
}

/** Упавший джоб очереди (событие `failed`). */
export async function alertJobFailure(
  queue: string,
  jobId: string | undefined,
  err: Error,
  extra: Record<string, unknown> = {},
): Promise<void> {
  console.error(JSON.stringify({
    level: 'error', service: 'worker', queue, jobId, message: err.message, ...extra,
    ts: new Date().toISOString(),
  }));

  const text = `🔴 [worker:${queue}] job=${jobId ?? '?'} ${err.message}`;
  await dispatch(text, {
    level: 'error', service: 'worker', queue, jobId,
    message: err.message, stack: err.stack?.slice(0, 2000), ...extra,
  });
}

/** Ошибка воркера (событие `error`), не привязана к джобу — сигнал, что очередь могла встать. */
export async function alertWorkerError(queue: string, err: Error): Promise<void> {
  console.error(`[${queue}] worker error`, err);

  const text = `🟠 [worker:${queue}] сбой воркера: ${err.message}`;
  await dispatch(text, {
    level: 'error', service: 'worker', queue, kind: 'worker-error',
    message: err.message, stack: err.stack?.slice(0, 2000),
  });
}

/** Вызывать перед `process.exit(1)` и дождаться — иначе процесс умрёт раньше доставки алерта. */
export async function alertCrash(scope: string, err: Error): Promise<void> {
  console.error(JSON.stringify({
    level: 'fatal', service: 'worker', scope, message: err.message, stack: err.stack,
    ts: new Date().toISOString(),
  }));

  const text = `🛑 [worker] упал процесс (${scope}): ${err.message}`;
  await dispatch(text, {
    level: 'fatal', service: 'worker', scope, kind: 'crash',
    message: err.message, stack: err.stack?.slice(0, 2000),
  });
}

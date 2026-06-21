// Алерты воркера: структурированный лог + Telegram/webhook (факт ошибки).
// Алертинг не бросает исключений в воркер.
const lastSent = new Map<string, number>();
const THROTTLE_MS = 60_000;

/**
 * Доставляет алерт во все настроенные каналы. Анти-шторм: одинаковый текст —
 * не чаще раза в THROTTLE_MS на процесс (решение принимается один раз, до веера
 * по каналам). Никогда не бросает.
 *
 * Каналы (любой/оба/ни одного):
 * - Telegram — если заданы TELEGRAM_BOT_TOKEN + TELEGRAM_ALERT_CHAT_ID;
 * - generic-webhook — если задан ALERT_WEBHOOK_URL (Discord/Slack/любой консьюмер).
 */
async function dispatch(text: string, fields: Record<string, unknown>): Promise<void> {
  const now = Date.now();
  const prev = lastSent.get(text);
  if (prev && now - prev < THROTTLE_MS) return;
  lastSent.set(text, now);

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
    // алерт падать молча
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
    // алерт падать молча
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

/**
 * Ошибка самого воркера (событие `error`) — не привязана к джобу: обрыв Redis,
 * сбой подключения и т.п. Сигнал, что очередь могла перестать обрабатываться.
 */
export async function alertWorkerError(queue: string, err: Error): Promise<void> {
  console.error(`[${queue}] worker error`, err);

  const text = `🟠 [worker:${queue}] сбой воркера: ${err.message}`;
  await dispatch(text, {
    level: 'error', service: 'worker', queue, kind: 'worker-error',
    message: err.message, stack: err.stack?.slice(0, 2000),
  });
}

/**
 * Падение процесса воркера: uncaughtException / unhandledRejection. Вызывать
 * перед `process.exit(1)` и дождаться — иначе процесс умрёт раньше доставки.
 */
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

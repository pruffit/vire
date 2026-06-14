// Webhook-алерты воркера: структурированный лог + опциональный POST на
// ALERT_WEBHOOK_URL. Без внешних зависимостей (global fetch, Node 18+).
// Алертинг не должен бросать в воркер.

const lastSent = new Map<string, number>();
const THROTTLE_MS = 60_000;

/**
 * Шлёт алерт на ALERT_WEBHOOK_URL, если он задан. Анти-шторм: одинаковый текст —
 * не чаще раза в THROTTLE_MS на процесс. Никогда не бросает.
 */
async function postWebhook(text: string, fields: Record<string, unknown>): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  const now = Date.now();
  const prev = lastSent.get(text);
  if (prev && now - prev < THROTTLE_MS) return;
  lastSent.set(text, now);

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
  await postWebhook(text, {
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
  await postWebhook(text, {
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
  await postWebhook(text, {
    level: 'fatal', service: 'worker', scope, kind: 'crash',
    message: err.message, stack: err.stack?.slice(0, 2000),
  });
}

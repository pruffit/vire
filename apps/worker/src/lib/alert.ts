// Webhook-алерты воркера: структурированный лог + опциональный POST на
// ALERT_WEBHOOK_URL. Без внешних зависимостей (global fetch, Node 18+).
// Алертинг не должен бросать в воркер.

const lastSent = new Map<string, number>();
const THROTTLE_MS = 60_000;

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

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  const text = `🔴 [worker:${queue}] job=${jobId ?? '?'} ${err.message}`;
  const now = Date.now();
  const prev = lastSent.get(text);
  if (prev && now - prev < THROTTLE_MS) return;
  lastSent.set(text, now);

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text, content: text, level: 'error', service: 'worker', queue, jobId,
        message: err.message, stack: err.stack?.slice(0, 2000), ...extra, ts: now,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // алерт падать молча
  }
}

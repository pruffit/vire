// Трекинг ошибок без внешних зависимостей: лог в stderr + опциональная доставка в
// Telegram/webhook. Алерты не должны бросать в вызывающий код.

import { createThrottleGate } from '@vire/core';

interface ErrorContext {
  service?: 'web' | 'worker';
  where?: string;
  [key: string]: unknown;
}

// Анти-шторм: один и тот же текст алерта шлём не чаще раза в 60с на процесс.
// Потолок записей обязателен — текст содержит уникальные сообщения ошибок.
const alertGate = createThrottleGate({ ttlMs: 60_000, maxSize: 500 });

// Известный шум — логируем, но не алертим: transformAlgorithm — баг Node webstreams
// при обрыве SSR-стрима, юзеров не задевает; Failed to find Server Action — старый
// деплой шлёт action-id из прошлого билда, штатно после каждого релиза.
const KNOWN_NOISE = [
  /transformAlgorithm is not a function/,
  /Failed to find Server Action/,
];

export function isKnownNoise(message: string): boolean {
  return KNOWN_NOISE.some((re) => re.test(message));
}

// Пустой message (брошен `new Error()`, пустая строка, объект) давал алерт вида
// «🔴 [web] POST /ru:» — без типа ошибки он нечитаем.
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message) return error.message;
    const digest = (error as { digest?: unknown }).digest;
    const suffix = typeof digest === 'string' && digest ? ` (digest=${digest})` : '';
    return `${error.name || 'Error'} без message${suffix}`;
  }

  const text = String(error);
  if (text.trim() && text !== '[object Object]') return text;
  return `без message: ${Object.prototype.toString.call(error)}`;
}

// Место ошибки в тексте алерта: без него digest без message стоит похода в логи контейнера,
// а деплой их стирает. routeType отделяет server action от рендера, route handler и proxy.
export function formatAlertText(service: string, ctx: ErrorContext, message: string): string {
  const parts = [ctx.routeType, ctx.routePath]
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  const suffix = parts.length > 0 ? ` [${parts.join(' ')}]` : '';
  return `🔴 [${service}] ${ctx.where ?? 'error'}: ${message}${suffix}`;
}

export async function captureError(error: unknown, ctx: ErrorContext = {}): Promise<void> {
  const message = describeError(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const service = ctx.service ?? 'web';
  const knownNoise = isKnownNoise(message);

  console.error(JSON.stringify({
    level: knownNoise ? 'warn' : 'error', service, message, knownNoise: knownNoise || undefined,
    ...stripService(ctx), ts: new Date().toISOString(),
  }));

  if (knownNoise) return;

  const text = formatAlertText(service, ctx, message);
  const now = Date.now();
  if (!alertGate.shouldPass(text, now)) return;

  await Promise.all([
    sendTelegram(text),
    sendWebhook({ text, content: text, level: 'error', service, where: ctx.where, message, stack: stack?.slice(0, 2000), ts: now }),
  ]);
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
    // алертинг падать молча — он не должен ломать основной поток
  }
}

// Generic-webhook — если задан ALERT_WEBHOOK_URL. text для Slack, content для Discord.
async function sendWebhook(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

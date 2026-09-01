import { okResponseSchema, sessionResponseSchema } from '@vire/api-contracts';
import { apiRequest } from '../api-client';
import { fileStore } from '../storage/file-store';
import type { ListenSpan } from './listen-tracker';

/**
 * Отправка прослушиваний на платформу.
 *
 * `sessionId` выдаёт и подписывает ТОЛЬКО сервер (`POST /api/v1/session`, HMAC): подпись
 * произвольного клиентского id обесценила бы её — накрутить можно было бы случайными id.
 * Поэтому id запрашивается один раз и хранится локально.
 *
 * Не отправленные события копятся на диске: на телефоне офлайн — нормальный режим, а
 * прослушивание скачанного трека должно дойти до статистики артиста, когда сеть вернётся.
 * Веб такой очереди не имеет, здесь она обязательна.
 */
const SESSION_KEY = 'play-session';
const PENDING_KEY = 'play-pending';

/** Верхняя граница буфера: дальше старые события дешевле потерять, чем растить файл. */
const PENDING_LIMIT = 200;

export function readPending(): ListenSpan[] {
  const raw = fileStore.getItem(PENDING_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ListenSpan[]) : [];
  } catch {
    return [];
  }
}

export function writePending(spans: ListenSpan[]): void {
  // Режем с головы: свежие прослушивания ценнее давних.
  fileStore.setItem(PENDING_KEY, JSON.stringify(spans.slice(-PENDING_LIMIT)));
}

let sessionPromise: Promise<string | null> | null = null;

async function getSessionId(): Promise<string | null> {
  const stored = fileStore.getItem(SESSION_KEY);
  if (stored) return stored;

  // Один запрос на несколько параллельных отправок.
  sessionPromise ??= (async () => {
    const result = await apiRequest('/api/v1/session', { method: 'POST', schema: sessionResponseSchema });
    if (!result.ok) return null;
    fileStore.setItem(SESSION_KEY, result.data.sessionId);
    return result.data.sessionId;
  })().finally(() => {
    sessionPromise = null;
  });

  return sessionPromise;
}

async function send(span: ListenSpan, sessionId: string): Promise<boolean> {
  const result = await apiRequest(`/api/v1/tracks/${encodeURIComponent(span.trackId)}/play`, {
    method: 'POST',
    schema: okResponseSchema,
    body: {
      sessionId,
      source: span.source,
      durationPlayedSec: span.durationPlayedSec,
      startedAt: span.startedAt,
    },
  });
  // 4xx означает, что событие не примут и при повторе — выбрасываем, чтобы не копить мусор.
  // Сеть и 5xx — оставляем в очереди.
  if (result.ok) return true;
  const status = result.error.status;
  return status >= 400 && status < 500;
}

/**
 * Кладёт событие в очередь и пытается разослать всё накопленное. Сбой не бросает: отчёт
 * о прослушивании не должен ломать воспроизведение.
 */
export async function reportListen(span: ListenSpan | null): Promise<void> {
  const pending = readPending();
  if (span) pending.push(span);
  if (pending.length === 0) return;
  writePending(pending);

  await flushPending();
}

let flushInFlight: Promise<void> | null = null;

/**
 * Рассылает накопленное. **Строго по одному проходу за раз**: рассылку дёргают уход в фон,
 * возврат из фона и восстановление стора, и два параллельных прохода читали одну и ту же
 * очередь — событие уходило на сервер по нескольку раз. Живой прогон дал четыре одинаковые
 * строки в `play_events`; для аналитики это накрутка прослушиваний.
 */
export function flushPending(): Promise<void> {
  flushInFlight ??= runFlush().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

async function runFlush(): Promise<void> {
  const pending = readPending();
  if (pending.length === 0) return;

  const sessionId = await getSessionId();
  if (!sessionId) return;

  const remaining: ListenSpan[] = [];
  for (const span of pending) {
    const done = await send(span, sessionId).catch(() => false);
    if (!done) remaining.push(span);
  }
  // Дописываем то, что успело накопиться, пока шла рассылка: перезапись «остатком»
  // потеряла бы события, добавленные в этот промежуток.
  const arrivedDuringFlush = readPending().slice(pending.length);
  writePending([...remaining, ...arrivedDuringFlush]);
}

/** Только для тестов: модульное состояние не сбрасывается между кейсами. */
export function __resetSessionForTests(): void {
  sessionPromise = null;
  flushInFlight = null;
}

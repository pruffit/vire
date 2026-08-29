/**
 * Разбор envelope-протокола Sentry. Чистый: ни сети, ни БД, ни времени.
 *
 * Зачем свой парсер — sentry.io отдаёт 403 на любой запрос из России (блок на
 * пограничном балансировщике, до приложения). Приёмник поднят свой, а SDK остаётся
 * стоковым `@sentry/react-native`: в DSN меняется только хост. Формат разбираем целиком
 * по спецификации, а не «как получится», чтобы позже можно было без правок клиента
 * переехать на self-hosted GlitchTip, который говорит на том же протоколе.
 *
 * Формат — построчный, НЕ JSON целиком:
 *
 *   {"event_id":"…","sent_at":"…"}            ← заголовок envelope
 *   {"type":"event","length":123}             ← заголовок элемента
 *   {"exception":{…}}                         ← полезная нагрузка элемента
 *   {"type":"attachment","length":9}          ← следующий элемент…
 *
 * `length` в заголовке элемента опционален; когда его нет, нагрузка — ровно одна строка.
 */

export interface SentryEnvelopeItem {
  type: string;
  payload: unknown;
}

export interface SentryEnvelope {
  header: Record<string, unknown>;
  items: SentryEnvelopeItem[];
}

/** Разобранное событие-падение — только те поля, по которым листают и фильтруют. */
export interface MobileCrashEvent {
  eventId: string;
  occurredAt: Date | null;
  level: string | null;
  platform: string | null;
  environment: string | null;
  release: string | null;
  dist: string | null;
  exceptionType: string | null;
  exceptionValue: string | null;
  appVersion: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  payload: unknown;
}

function parseJsonLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseSentryEnvelope(raw: string): SentryEnvelope | null {
  // \r\n встречается у прокси, переписывающих тело; на разбор влиять не должен.
  const lines = raw.split(/\r?\n/);
  const header = asRecord(parseJsonLine(lines[0] ?? ''));
  if (!header) return null;

  const items: SentryEnvelopeItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const itemHeader = asRecord(parseJsonLine(line));
    if (!itemHeader) continue;

    const payloadLine = lines[++i];
    if (payloadLine === undefined) break;

    items.push({
      type: str(itemHeader.type) ?? 'unknown',
      payload: parseJsonLine(payloadLine),
    });
  }

  return { header, items };
}

/** Момент события: SDK шлёт `timestamp` секундами Unix, изредка — строкой ISO. */
function eventTimestamp(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = str(value);
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Достаёт из envelope первое событие-падение. `null`, если события нет — envelope может
 * нести только сессии, транзакции или вложения, и это не ошибка.
 */
export function extractCrashEvent(envelope: SentryEnvelope): MobileCrashEvent | null {
  const item = envelope.items.find((i) => i.type === 'event');
  const event = item ? asRecord(item.payload) : null;
  if (!event) return null;

  const eventId = str(event.event_id) ?? str(envelope.header.event_id);
  if (!eventId) return null;

  const contexts = asRecord(event.contexts) ?? {};
  const app = asRecord(contexts.app) ?? {};
  const device = asRecord(contexts.device) ?? {};
  const os = asRecord(contexts.os) ?? {};

  const values = asRecord(event.exception)?.values;
  const firstException = Array.isArray(values) ? asRecord(values[0]) : null;

  return {
    eventId,
    occurredAt: eventTimestamp(event.timestamp),
    level: str(event.level),
    platform: str(event.platform),
    environment: str(event.environment),
    release: str(event.release),
    dist: str(event.dist),
    exceptionType: firstException ? str(firstException.type) : null,
    exceptionValue: firstException ? str(firstException.value) : null,
    appVersion: str(app.app_version),
    deviceModel: str(device.model),
    osVersion: str(os.version),
    payload: event,
  };
}

import { alertWorkerError, alertRecovered } from './alert.js';

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED', 'EAI_AGAIN', 'ECONNRESET', 'ENOTFOUND',
  'EPIPE', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH',
]);

const CONNECTION_ERROR_TEXTS = [
  'Connection is closed',
  "Stream isn't writeable",
  'Command timed out',
];

/** `Missing lock … moveToFinished` под это не подводим — это потеря работы, а не обрыв связи. */
export function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  if (code !== undefined && CONNECTION_ERROR_CODES.has(code)) return true;
  return CONNECTION_ERROR_TEXTS.some((text) => err.message.includes(text));
}

/** Обрыв в пределах этого окна после закрытия — продолжение той же серии, не новый инцидент. */
const FLAP_WINDOW_MS = 60_000;

// Инцидент один на процесс, а не на источник (соединение bullmq или сторож живости) —
// оба видят один и тот же Redis.
let everReady = false;
let downSince: number | null = null;
let incidentStart: number | null = null;
let recoveryTimer: NodeJS.Timeout | null = null;
let shuttingDown = false;

export function isRedisArmed(): boolean {
  return everReady;
}

/** До первого успеха молчим — иначе медленный старт Redis при деплое даёт ложную пару. */
export function armRedisIncidents(): void {
  everReady = true;
}

export function noteRedisDown(err: Error, now: number = Date.now()): void {
  if (shuttingDown || !everReady || downSince !== null) return;
  downSince = now;
  if (recoveryTimer !== null) {
    // Обрыв внутри окна флаппинга — продолжение открытого инцидента, повторной пары 🟠/🟢 нет.
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
    return;
  }
  incidentStart = now;
  void alertWorkerError('redis', err);
}

export function noteRedisUp(now: number = Date.now()): void {
  if (shuttingDown || downSince === null) return;
  downSince = null;
  const recoveredAt = now;
  // 🟢 не шлём сразу — ждём окно флаппинга: обрыв внутри него отменит этот таймер.
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    const start = incidentStart;
    incidentStart = null;
    if (start === null || shuttingDown) return;
    void alertRecovered('redis', recoveredAt - start);
  }, FLAP_WINDOW_MS);
  recoveryTimer.unref();
}

export function beginRedisShutdown(): void {
  shuttingDown = true;
}

/** Ошибки уровня соединения сводятся к общему инциденту `redis`, остальное — алерт по своей очереди. */
export function reportWorkerError(queue: string, err: Error): void {
  if (isConnectionError(err)) {
    noteRedisDown(err);
    return;
  }
  void alertWorkerError(queue, err);
}

/** Только для тестов. */
export function resetRedisIncident(): void {
  everReady = false;
  downSince = null;
  incidentStart = null;
  shuttingDown = false;
  if (recoveryTimer !== null) clearTimeout(recoveryTimer);
  recoveryTimer = null;
}

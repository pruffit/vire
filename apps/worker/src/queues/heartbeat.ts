import Redis from 'ioredis';
import { alertStall } from '../lib/alert.js';
import { armRedisIncidents, isRedisArmed, noteRedisDown, noteRedisUp } from '../lib/redis-incident.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const INTERVAL_MS = 15_000;
// commandTimeout — таймер промиса, сокет не трогает; socketTimeout рвёт зомби-сокет и включает retry.
const PROBE_TIMEOUT_MS = 5_000;
// Выше самого длинного лока (10 мин у transcode/analyze/analyze-genre) — иначе штатная
// блокировка event loop на ffmpeg/ONNX превращала бы каждый тяжёлый релиз в ложный алерт.
const STALL_MS = 15 * 60_000;
const STARTUP_GRACE_MS = 60_000;

let client: Redis | null = null;
let timer: NodeJS.Timeout | null = null;
let expectedAt = 0;
let startedAt = 0;
// Раньше отсутствие наложения тиков держалось на COMMAND_TIMEOUT_MS < INTERVAL_MS, нигде не закреплённом.
let tickInFlight = false;

async function tick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const now = Date.now();
    const lateMs = now - expectedAt;
    expectedAt = now + INTERVAL_MS;

    if (lateMs > STALL_MS) {
      void alertStall(lateMs);
    } else if (lateMs > 60_000) {
      console.warn(`[heartbeat] тик с опозданием ${lateMs}мс`);
    }

    await client?.ping();
    armRedisIncidents();
    noteRedisUp(Date.now());
  } catch (err) {
    const now = Date.now();
    // Redis, не поднявшийся за грейс, — уже не гонка деплоя, а авария: без этого воркер,
    // стартовавший в мёртвый Redis, молчал бы вовсе.
    if (!isRedisArmed() && now - startedAt > STARTUP_GRACE_MS) armRedisIncidents();
    noteRedisDown(err instanceof Error ? err : new Error(String(err)), now);
  } finally {
    tickInFlight = false;
  }
}

/** Отдельный клиент: общий инстанс (connection.ts) держит maxRetriesPerRequest: null и
 *  офлайн-очередь — его PING повиснет ровно так же, как всё остальное. */
export function startHeartbeat(): void {
  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    commandTimeout: PROBE_TIMEOUT_MS,
    socketTimeout: PROBE_TIMEOUT_MS,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    protocol: 2,
  });
  client.on('error', (err: Error) => {
    // Алерт не шлём — его уже даёт провалившийся PING в tick(); лог отличает сторожа от общего соединения.
    console.warn(`[heartbeat] ошибка соединения: ${err.message}`);
  });

  startedAt = Date.now();
  expectedAt = startedAt + INTERVAL_MS;
  timer = setInterval(() => {
    void tick();
  }, INTERVAL_MS);
  timer.unref();
}

export async function stopHeartbeat(): Promise<void> {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  const c = client;
  client = null;
  if (c) {
    try {
      await c.quit();
    } catch {
      // соединение уже оборвано — на выходе это ничего не меняет
    }
  }
}

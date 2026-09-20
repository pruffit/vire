import Redis from 'ioredis';
import { armRedisIncidents, beginRedisShutdown, noteRedisDown, noteRedisUp } from '../lib/redis-incident.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Один инстанс на процесс: bullmq переиспользует его под обычные команды, а блокирующее
// соединение каждый воркер дублирует сам (utils/create-backend.js) — общий клиент безопасен.
// maxRetriesPerRequest: null обязателен для блокирующих команд bullmq.
export const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
  // ioredis 6 включил RESP3 по умолчанию; держим формат ответов v5, как остальной код.
  protocol: 2,
});

// Обрыв не виден сразу: команды с maxRetriesPerRequest: null ждут вечно, авария всплывает
// часами позже хвостом потерянных локов. Состояние инцидента — в redis-incident.ts.
let lastError: Error | null = null;

connection.on('error', (err: Error) => {
  lastError = err;
  console.error(`[redis] ошибка соединения: ${err.message}`);
});

connection.on('close', () => {
  noteRedisDown(lastError ?? new Error('соединение закрыто'));
});

connection.on('reconnecting', (delay: number) => {
  console.warn(`[redis] переподключение через ${delay}мс`);
});

connection.on('ready', () => {
  armRedisIncidents();
  noteRedisUp();
});

/** bullmq не закрывает переданный инстанс сам (shared) — гасим на SIGTERM руками. */
export async function closeConnection(): Promise<void> {
  beginRedisShutdown();
  try {
    await connection.quit();
  } catch {
    // соединение уже оборвано — на выходе это ничего не меняет
  }
}

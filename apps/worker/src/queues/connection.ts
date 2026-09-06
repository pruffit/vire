import Redis from 'ioredis';
import { alertWorkerError, alertRecovered } from '../lib/alert.js';

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

// Обрыв Redis иначе не виден в момент обрыва: команды с maxRetriesPerRequest: null ждут
// вечно, и авария всплывает часами позже — хвостом из потерянных локов уже отработавших джоб.
let lastError: Error | null = null;
let downSince: number | null = null;
let everReady = false;
let shuttingDown = false;

connection.on('error', (err: Error) => {
  lastError = err;
  console.error(`[redis] ошибка соединения: ${err.message}`);
});

// Алерт один на инцидент, а не на ошибку: ioredis повторяет error/close на каждой попытке
// переподключения, и часовой обрыв иначе даёт десятки сообщений в канал. До первого ready
// молчим — иначе каждый деплой, где redis встаёт медленнее воркера, даёт ложную пару.
connection.on('close', () => {
  if (shuttingDown || !everReady || downSince !== null) return;
  downSince = Date.now();
  void alertWorkerError('redis', lastError ?? new Error('соединение закрыто'));
});

connection.on('reconnecting', (delay: number) => {
  console.warn(`[redis] переподключение через ${delay}мс`);
});

connection.on('ready', () => {
  everReady = true;
  if (downSince === null) return;
  const downMs = Date.now() - downSince;
  downSince = null;
  void alertRecovered('redis', downMs);
});

/** bullmq не закрывает переданный инстанс сам (shared) — гасим на SIGTERM руками. */
export async function closeConnection(): Promise<void> {
  shuttingDown = true;
  try {
    await connection.quit();
  } catch {
    // соединение уже оборвано — на выходе это ничего не меняет
  }
}

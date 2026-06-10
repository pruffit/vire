import Redis from 'ioredis';

/**
 * Live-присутствие «слушают сейчас» на Redis.
 *
 * Каждый играющий клиент шлёт heartbeat (~раз в 20с). Присутствие хранится в
 * ZSET по треку: member = sessionId, score = время последнего heartbeat (мс).
 * «Слушают сейчас» = члены со score в пределах окна (WINDOW). Протухшие
 * вычищаются ZREMRANGEBYSCORE, сам ключ живёт KEY_TTL после последней
 * активности — закрытая вкладка просто перестаёт слать heartbeat и исчезает
 * из счётчика без явного «ушёл».
 */

// Клиент должен слать heartbeat чаще, чем WINDOW (см. HEARTBEAT_MS в плеере).
export const WINDOW_MS = 45_000;
const KEY_TTL_SEC = 120;

const globalForRedis = globalThis as unknown as { _presenceRedis?: Redis };

function getRedis(): Redis {
  if (!globalForRedis._presenceRedis) {
    globalForRedis._presenceRedis = new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      { maxRetriesPerRequest: null, lazyConnect: false },
    );
    // Без обработчика ioredis роняет процесс на сетевой ошибке Redis.
    globalForRedis._presenceRedis.on('error', () => {});
  }
  return globalForRedis._presenceRedis;
}

const trackKey = (trackId: string) => `presence:track:${trackId}`;

/** Записывает heartbeat и возвращает актуальное число слушателей трека. */
export async function recordListening(trackId: string, sessionId: string): Promise<number> {
  const redis = getRedis();
  const now = Date.now();
  const key = trackKey(trackId);
  const [, count] = await redis
    .multi()
    .zadd(key, now, sessionId)
    .zremrangebyscore(key, 0, now - WINDOW_MS)
    .zcard(key)
    .expire(key, KEY_TTL_SEC)
    .exec()
    .then((res) => [res?.[0], Number(res?.[2]?.[1] ?? 0)] as const);
  return count;
}

/** Число слушателей трека сейчас (чистит протухших, не записывает). */
export async function countListening(trackId: string): Promise<number> {
  const redis = getRedis();
  const now = Date.now();
  const key = trackKey(trackId);
  const res = await redis
    .multi()
    .zremrangebyscore(key, 0, now - WINDOW_MS)
    .zcard(key)
    .exec();
  return Number(res?.[1]?.[1] ?? 0);
}

/** Все треки с активными слушателями сейчас (для секции на главной).
 *  Перечисляет presence-ключи через SCAN — их единицы-десятки, это дёшево. */
export async function listListening(limit = 12): Promise<Array<{ trackId: string; count: number }>> {
  const redis = getRedis();
  const now = Date.now();

  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', 'presence:track:*', 'COUNT', 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0' && keys.length < 500);
  if (keys.length === 0) return [];

  const pipeline = redis.multi();
  for (const key of keys) {
    pipeline.zremrangebyscore(key, 0, now - WINDOW_MS);
    pipeline.zcard(key);
  }
  const res = await pipeline.exec();
  if (!res) return [];

  const out: Array<{ trackId: string; count: number }> = [];
  for (let i = 0; i < keys.length; i++) {
    const count = Number(res[i * 2 + 1]?.[1] ?? 0);
    if (count > 0) out.push({ trackId: keys[i].slice('presence:track:'.length), count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Суммарное число слушателей по нескольким трекам (для дашборда артиста). */
export async function countListeningMany(trackIds: string[]): Promise<number> {
  if (trackIds.length === 0) return 0;
  const redis = getRedis();
  const now = Date.now();
  const pipeline = redis.multi();
  for (const id of trackIds) {
    const key = trackKey(id);
    pipeline.zremrangebyscore(key, 0, now - WINDOW_MS);
    pipeline.zcard(key);
  }
  const res = await pipeline.exec();
  if (!res) return 0;
  // Результаты идут парами: [zremrangebyscore, zcard] на каждый трек.
  let total = 0;
  for (let i = 1; i < res.length; i += 2) {
    total += Number(res[i]?.[1] ?? 0);
  }
  return total;
}

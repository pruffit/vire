import Redis from 'ioredis';

/**
 * Состояние волны на Redis: анти-повтор (какие треки уже выданы в рамках
 * сессии) + закреплённый в начале сессии seed mood/genre. Ключи живут 6ч
 * после последней активности — как presence, деградирует до пустого
 * состояния при любой ошибке Redis (никогда не роняет выдачу волны).
 */

const TTL_SEC = 6 * 60 * 60;

const globalForRedis = globalThis as unknown as { _waveRedis?: Redis };

function getRedis(): Redis {
  if (!globalForRedis._waveRedis) {
    globalForRedis._waveRedis = new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      { maxRetriesPerRequest: null, lazyConnect: false },
    );
    globalForRedis._waveRedis.on('error', () => {});
  }
  return globalForRedis._waveRedis;
}

const servedKey = (sessionId: string) => `wave:served:${sessionId}`;
const seedKey = (sessionId: string) => `wave:seed:${sessionId}`;

export interface WaveSession {
  servedIds: string[];
  mood: string | null;
  genre: string | null;
}

/** Читает состояние сессии волны. Недоступный Redis → пустая сессия. */
export async function getWaveSession(sessionId: string): Promise<WaveSession> {
  try {
    const redis = getRedis();
    const [servedIds, seed] = await Promise.all([
      redis.smembers(servedKey(sessionId)),
      redis.hgetall(seedKey(sessionId)),
    ]);
    return { servedIds, mood: seed.mood ?? null, genre: seed.genre ?? null };
  } catch {
    return { servedIds: [], mood: null, genre: null };
  }
}

/** Отмечает треки как выданные в сессии (анти-повтор), продлевает TTL. */
export async function appendWaveServed(sessionId: string, trackIds: string[]): Promise<void> {
  if (trackIds.length === 0) return;
  try {
    const redis = getRedis();
    const key = servedKey(sessionId);
    await redis.sadd(key, ...trackIds);
    await redis.expire(key, TTL_SEC);
  } catch {
    // Недоступность Redis не должна ронять выдачу волны.
  }
}

/** Закрепляет mood/genre, выбранные слушателем в начале сессии волны. */
export async function setWaveSessionSeed(
  sessionId: string,
  seed: { mood?: string; genre?: string },
): Promise<void> {
  const fields: Record<string, string> = {};
  if (seed.mood) fields.mood = seed.mood;
  if (seed.genre) fields.genre = seed.genre;
  if (Object.keys(fields).length === 0) return;

  try {
    const redis = getRedis();
    const key = seedKey(sessionId);
    await redis.hset(key, fields);
    await redis.expire(key, TTL_SEC);
  } catch {
    // Недоступность Redis не должна ронять выдачу волны.
  }
}

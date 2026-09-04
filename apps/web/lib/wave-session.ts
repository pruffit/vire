import { WAVE_SESSION_TTL_SEC, WAVE_SESSION_MAX_SERVED, waveServedKey, waveSeedKey } from '@vire/core';
import { getRedis } from './redis';

// Состояние волны на Redis: анти-повтор выданных треков + seed mood/genre сессии.
// TTL 6ч; любая ошибка Redis деградирует до пустого состояния, выдачу не роняет.

const TTL_SEC = WAVE_SESSION_TTL_SEC;
const MAX_SERVED_IDS = WAVE_SESSION_MAX_SERVED;

const servedKey = waveServedKey;
const seedKey = waveSeedKey;

export interface WaveSession {
  servedIds: string[];
  /** Истинно последние 5 выданных треков (по recency в ZSET), для recentArtistIds. */
  recentServedIds: string[];
  mood: string | null;
  genre: string | null;
}

/** Читает состояние сессии волны. Недоступный Redis → пустая сессия. */
export async function getWaveSession(sessionId: string): Promise<WaveSession> {
  try {
    const redis = getRedis();
    const key = servedKey(sessionId);
    const [servedIds, recentServedIds, seed] = await Promise.all([
      redis.zrange(key, String(-MAX_SERVED_IDS), '-1'),
      redis.zrange(key, '-5', '-1'),
      redis.hgetall(seedKey(sessionId)),
    ]);
    return { servedIds, recentServedIds, mood: seed.mood ?? null, genre: seed.genre ?? null };
  } catch {
    return { servedIds: [], recentServedIds: [], mood: null, genre: null };
  }
}

/** Отмечает треки как выданные в сессии (анти-повтор + recency), продлевает TTL. */
export async function appendWaveServed(sessionId: string, trackIds: string[]): Promise<void> {
  if (trackIds.length === 0) return;
  try {
    const redis = getRedis();
    const key = servedKey(sessionId);
    const now = Date.now();
    const pipeline = redis.multi();
    // +index сохраняет порядок выдачи внутри одного батча (иначе одинаковый score рвёт recency).
    trackIds.forEach((trackId, index) => {
      pipeline.zadd(key, now + index, trackId);
    });
    pipeline.expire(key, TTL_SEC);
    await pipeline.exec();
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

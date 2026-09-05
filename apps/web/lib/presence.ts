import { PRESENCE_TRACK_PREFIX, PRESENCE_SITE_KEY, presenceTrackKey, presenceUserKey } from '@vire/core';
import { getRedis } from './redis';

/**
 * Live-присутствие на Redis: ZSET по треку (member=sessionId, score=время heartbeat, мс);
 * «сейчас» = score в пределах WINDOW_MS. Закрытая вкладка просто перестаёт слать heartbeat
 * и выпадает из окна без явного «ушёл».
 */

// Клиент должен слать heartbeat чаще, чем WINDOW (см. HEARTBEAT_MS в плеере).
export const WINDOW_MS = 45_000;
const KEY_TTL_SEC = 120;

const trackKey = presenceTrackKey;
// Присутствие на сайте в целом (не на конкретном треке) — один ZSET на всех.
const SITE_KEY = PRESENCE_SITE_KEY;

/** Пинг Redis: латентность в мс или null, если недоступен (для health-панели). */
export async function pingRedis(): Promise<number | null> {
  try {
    const redis = getRedis();
    const t0 = Date.now();
    await redis.ping();
    return Date.now() - t0;
  } catch {
    return null;
  }
}

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
    const [next, batch] = await redis.scan(cursor, 'MATCH', `${PRESENCE_TRACK_PREFIX}*`, 'COUNT', 100);
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
    if (count > 0) out.push({ trackId: keys[i].slice(PRESENCE_TRACK_PREFIX.length), count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Heartbeat присутствия на сайте (любая страница). Возвращает онлайн сейчас. */
export async function recordSitePresence(sessionId: string): Promise<number> {
  const redis = getRedis();
  const now = Date.now();
  const res = await redis
    .multi()
    .zadd(SITE_KEY, now, sessionId)
    .zremrangebyscore(SITE_KEY, 0, now - WINDOW_MS)
    .zcard(SITE_KEY)
    .expire(SITE_KEY, KEY_TTL_SEC)
    .exec();
  return Number(res?.[2]?.[1] ?? 0);
}

/** Сколько человек на сайте прямо сейчас (для админ-панели). Деградирует до 0. */
export async function countSiteOnline(): Promise<number> {
  try {
    const redis = getRedis();
    const now = Date.now();
    const res = await redis
      .multi()
      .zremrangebyscore(SITE_KEY, 0, now - WINDOW_MS)
      .zcard(SITE_KEY)
      .exec();
    return Number(res?.[1]?.[1] ?? 0);
  } catch {
    return 0;
  }
}

const USER_PRESENCE_TTL_SEC = 40; // > SSE heartbeat (25с)

/** Помечает пользователя онлайн (активный SSE-стрим). Деградирует молча при недоступности Redis. */
export async function markUserOnline(userId: string): Promise<void> {
  try {
    await getRedis().set(presenceUserKey(userId), '1', 'EX', USER_PRESENCE_TTL_SEC);
  } catch {
    // нет Redis — деградация
  }
}

/** Онлайн ли пользователь сейчас (для воркера — пропускать внешние уведомления). */
export async function isUserOnline(userId: string): Promise<boolean> {
  try {
    return (await getRedis().exists(presenceUserKey(userId))) === 1;
  } catch {
    return false;
  }
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

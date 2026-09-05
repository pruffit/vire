import type { IJamStateStore, JamPlaybackState } from '@vire/core';
import { getRedis } from '../redis';

// Presence-окно того же порядка, что apps/web/lib/presence.ts — гости шлют heartbeat чаще этого.
const PRESENCE_WINDOW_MS = 45_000;
const PRESENCE_KEY_TTL_SEC = 120;
const PLAYBACK_TTL_SEC = 12 * 60 * 60;
const ADD_COUNTER_WINDOW_SEC = 60;

const playbackKey = (jamId: string) => `jam:${jamId}:playback`;
const presenceKey = (jamId: string) => `jam:${jamId}:presence`;
const addCounterKey = (jamId: string, participantKey: string) => `jam:${jamId}:adds:${participantKey}`;
const skipVotesKey = (jamId: string, itemId: string) => `jam:${jamId}:skip:${itemId}`;

export class RedisJamStateStore implements IJamStateStore {
  async getPlayback(jamId: string): Promise<JamPlaybackState | null> {
    try {
      const raw = await getRedis().get(playbackKey(jamId));
      return raw ? (JSON.parse(raw) as JamPlaybackState) : null;
    } catch {
      return null;
    }
  }

  async setPlayback(jamId: string, state: JamPlaybackState): Promise<void> {
    try {
      await getRedis().set(playbackKey(jamId), JSON.stringify(state), 'EX', PLAYBACK_TTL_SEC);
    } catch {
      // Redis недоступен — деградация, состояние переживёт только в Postgres/у клиентов
    }
  }

  async heartbeat(jamId: string, participantKey: string): Promise<void> {
    try {
      const redis = getRedis();
      const now = Date.now();
      const key = presenceKey(jamId);
      await redis
        .multi()
        .zadd(key, now, participantKey)
        .zremrangebyscore(key, 0, now - PRESENCE_WINDOW_MS)
        .expire(key, PRESENCE_KEY_TTL_SEC)
        .exec();
    } catch {
      // деградация — presence просто не покажет этого участника
    }
  }

  async listPresent(jamId: string): Promise<string[]> {
    try {
      const redis = getRedis();
      const now = Date.now();
      const key = presenceKey(jamId);
      const res = await redis
        .multi()
        .zremrangebyscore(key, 0, now - PRESENCE_WINDOW_MS)
        .zrange(key, '0', '-1')
        .exec();
      const members = res?.[1]?.[1];
      return Array.isArray(members) ? (members as string[]) : [];
    } catch {
      return [];
    }
  }

  async dropPresence(jamId: string, participantKey: string): Promise<void> {
    try {
      await getRedis().zrem(presenceKey(jamId), participantKey);
    } catch {
      // деградация — запись присутствия истечёт сама по TTL
    }
  }

  async bumpAddCounter(jamId: string, participantKey: string): Promise<number> {
    try {
      const redis = getRedis();
      const key = addCounterKey(jamId, participantKey);
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, ADD_COUNTER_WINDOW_SEC);
      return count;
    } catch {
      // 0 = «лимит не превышен» — не блокируем добавление треков из-за упавшего Redis
      return 0;
    }
  }

  async addSkipVote(jamId: string, itemId: string, participantKey: string): Promise<number> {
    try {
      const redis = getRedis();
      const key = skipVotesKey(jamId, itemId);
      await redis.sadd(key, participantKey);
      await redis.expire(key, PLAYBACK_TTL_SEC);
      return await redis.scard(key);
    } catch {
      // 0 — деградация не должна ложно триггерить/блокировать скип
      return 0;
    }
  }

  async clearSkipVotes(jamId: string, itemId: string): Promise<void> {
    try {
      await getRedis().del(skipVotesKey(jamId, itemId));
    } catch {
      // деградация — ключ истечёт сам по TTL
    }
  }

  async clear(jamId: string): Promise<void> {
    try {
      await getRedis().del(playbackKey(jamId), presenceKey(jamId));
    } catch {
      // деградация — ключи истекут сами по TTL
    }
  }
}

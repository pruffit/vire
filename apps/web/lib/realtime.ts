import Redis from 'ioredis';
import { EventEmitter } from 'node:events';
import type { RealtimePublisher, RealtimeEvent } from '@vire/core';

/**
 * SSE поверх Redis pub/sub: один канал на пользователя (`rt:user:{id}`), несёт и чат-события,
 * и уведомления. Публикующий клиент — обычный ioredis (командный режим). Подписчик — ОТДЕЛЬНОЕ
 * соединение в PSUBSCRIBE-режиме (подписка блокирует клиент для обычных команд), fan-out в
 * общий EventEmitter по имени канала; SSE-роут навешивает/снимает листенер на свой канал.
 */

const CHANNEL_PREFIX = 'rt:user:';
const PSUBSCRIBE_PATTERN = 'rt:*';

const globalForRealtime = globalThis as unknown as {
  _realtimePublisherRedis?: Redis;
  _realtimeSubscriberRedis?: Redis;
  _realtimeEmitter?: EventEmitter;
};

function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379';
}

function getPublisherRedis(): Redis {
  if (!globalForRealtime._realtimePublisherRedis) {
    const redis = new Redis(redisUrl(), { maxRetriesPerRequest: null, lazyConnect: false });
    redis.on('error', () => {});
    globalForRealtime._realtimePublisherRedis = redis;
  }
  return globalForRealtime._realtimePublisherRedis;
}

function getEmitter(): EventEmitter {
  if (!globalForRealtime._realtimeEmitter) {
    const emitter = new EventEmitter();
    // Много одновременных SSE-соединений на процесс — не варн на лимит листенеров.
    emitter.setMaxListeners(0);
    globalForRealtime._realtimeEmitter = emitter;
  }
  return globalForRealtime._realtimeEmitter;
}

function ensureSubscriber(): void {
  if (globalForRealtime._realtimeSubscriberRedis) return;
  const sub = new Redis(redisUrl(), { maxRetriesPerRequest: null, lazyConnect: false });
  sub.on('error', () => {});
  sub.psubscribe(PSUBSCRIBE_PATTERN).catch(() => {});
  sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
    let payload: unknown;
    try {
      payload = JSON.parse(message);
    } catch {
      return;
    }
    getEmitter().emit(channel, payload);
  });
  globalForRealtime._realtimeSubscriberRedis = sub;
}

/** Публикация на канал пользователя. Деградирует молча — REST-поллинг остаётся фолбэком. */
export async function publish(userId: string, event: RealtimeEvent): Promise<void> {
  try {
    await getPublisherRedis().publish(`${CHANNEL_PREFIX}${userId}`, JSON.stringify(event));
  } catch {
    // нет Redis — событие теряется
  }
}

/** Подписка SSE-хендлера на канал пользователя. Возвращает функцию отписки (cleanup по abort). */
export function subscribe(userId: string, cb: (event: unknown) => void): () => void {
  ensureSubscriber();
  const channel = `${CHANNEL_PREFIX}${userId}`;
  const emitter = getEmitter();
  emitter.on(channel, cb);
  return () => emitter.off(channel, cb);
}

export const realtimePublisher: RealtimePublisher = { publish };

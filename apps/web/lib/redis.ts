import Redis from 'ioredis';

// Одно соединение на процесс для всего, что ходит в Redis мимо BullMQ: presence,
// rate limiting, сессии волны и привязки устройств, состояние джема, кэш last.fm.
// Раньше каждый из этих модулей заводил своё — шесть одинаковых подключений к одному
// серверу на 2 ГБ VPS. Отдельное соединение нужно только под pub/sub или блокирующие
// команды (они переводят клиента в особый режим); здесь ни того, ни другого нет.
//
// Кэш в globalThis, а не в модульной переменной: в dev hot-reload перезагружает модуль
// и накопил бы по соединению на каждую правку.
const globalForRedis = globalThis as unknown as { _redis?: Redis };

export function getRedis(): Redis {
  if (!globalForRedis._redis) {
    globalForRedis._redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    // Без обработчика ioredis роняет процесс на сетевой ошибке Redis.
    globalForRedis._redis.on('error', () => {});
  }
  return globalForRedis._redis;
}

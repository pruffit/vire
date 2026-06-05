// Передаём plain options — bullmq создаёт своё Redis-соединение.
// maxRetriesPerRequest: null обязателен для BullMQ блокирующих команд.
// url поддерживается нативно через bullmq BaseOptions.
export const connection = {
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  maxRetriesPerRequest: null as null,
};

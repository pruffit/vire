import Redis from 'ioredis';
let client: Redis | null = null;
function redis(): Redis {
  if (!client) { client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null, lazyConnect: false }); client.on('error', () => {}); }
  return client;
}
export async function isUserOnline(userId: string): Promise<boolean> {
  try { return (await redis().exists(`presence:user:${userId}`)) === 1; } catch { return false; }
}

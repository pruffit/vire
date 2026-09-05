import Redis from 'ioredis';
import { presenceUserKey } from '@vire/core';

let client: Redis | null = null;
function redis(): Redis {
  if (!client) { client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null, lazyConnect: false, protocol: 2 }); client.on('error', () => {}); }
  return client;
}
export async function isUserOnline(userId: string): Promise<boolean> {
  try { return (await redis().exists(presenceUserKey(userId))) === 1; } catch { return false; }
}

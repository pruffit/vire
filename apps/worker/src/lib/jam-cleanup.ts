import Redis from 'ioredis';
import { connection } from '../queues/connection.js';

let client: Redis | null = null;
function redis(): Redis {
  if (!client) {
    client = new Redis(connection.url, { maxRetriesPerRequest: null, lazyConnect: false });
    client.on('error', () => {});
  }
  return client;
}

// Ключи и формат события — те же, что apps/web/lib/jam/jam-state.ts и apps/web/lib/realtime.ts.
const playbackKey = (jamId: string) => `jam:${jamId}:playback`;
const presenceKey = (jamId: string) => `jam:${jamId}:presence`;
const jamChannel = (jamId: string) => `rt:jam:${jamId}`;

export async function reapJamRedisState(jamId: string): Promise<void> {
  try {
    await redis().del(playbackKey(jamId), presenceKey(jamId));
    await redis().publish(jamChannel(jamId), JSON.stringify({ type: 'jam:ended' }));
  } catch {
    // Redis недоступен — деградация, сессия в Postgres уже ENDED
  }
}

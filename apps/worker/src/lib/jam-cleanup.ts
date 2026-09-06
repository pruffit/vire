import { connection } from '../queues/connection.js';

// Ключи и формат события — те же, что apps/web/lib/jam/jam-state.ts и apps/web/lib/realtime.ts.
const playbackKey = (jamId: string) => `jam:${jamId}:playback`;
const presenceKey = (jamId: string) => `jam:${jamId}:presence`;
const jamChannel = (jamId: string) => `rt:jam:${jamId}`;

export async function reapJamRedisState(jamId: string): Promise<void> {
  try {
    await connection.del(playbackKey(jamId), presenceKey(jamId));
    await connection.publish(jamChannel(jamId), JSON.stringify({ type: 'jam:ended' }));
  } catch {
    // Redis недоступен — деградация, сессия в Postgres уже ENDED
  }
}

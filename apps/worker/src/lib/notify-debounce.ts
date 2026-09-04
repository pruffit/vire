import Redis from 'ioredis';
let client: Redis | null = null;
function redis(): Redis {
  if (!client) { client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null, lazyConnect: false, protocol: 2 }); client.on('error', () => {}); }
  return client;
}
const TTL_SEC = 15 * 60;
/** true = в окне дебаунса (письмо уже слали), false = можно слать (и ставит флаг). Ошибка Redis → false (fail-open). */
export async function chatEmailDebounced(recipientId: string, conversationId: string): Promise<boolean> {
  try {
    const key = `notify:chat:emailed:${recipientId}:${conversationId}`;
    const set = await redis().set(key, '1', 'EX', TTL_SEC, 'NX');
    return set === null; // NX не сработал → ключ уже был → дебаунс активен
  } catch { return false; }
}

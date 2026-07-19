import Redis from 'ioredis';

const TTL_SEC = 300;

const globalForRedis = globalThis as unknown as { _linkRedis?: Redis };

function getRedis(): Redis {
  if (!globalForRedis._linkRedis) {
    globalForRedis._linkRedis = new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      { maxRetriesPerRequest: null, lazyConnect: false },
    );
    globalForRedis._linkRedis.on('error', () => {});
  }
  return globalForRedis._linkRedis;
}

const key = (id: string) => `chat:link:${id}`;

export interface LinkState {
  userId: string;
  ebPub: string;
  eaPub?: string;
  wrapped?: string;
  nonce?: string;
  status: 'pending' | 'completed';
}

// Новое устройство (B) открывает сессию своим эфемерным ключом. Redis недоступен → null (привязка недоступна).
export async function startLink(userId: string, ebPub: string): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    const state: LinkState = { userId, ebPub, status: 'pending' };
    await getRedis().set(key(id), JSON.stringify(state), 'EX', TTL_SEC);
    return id;
  } catch {
    return null;
  }
}

// Возвращает состояние только владельцу (тот же userId) — оба устройства это один залогиненный юзер.
export async function getLink(id: string, userId: string): Promise<LinkState | null> {
  try {
    const raw = await getRedis().get(key(id));
    if (!raw) return null;
    const state = JSON.parse(raw) as LinkState;
    return state.userId === userId ? state : null;
  } catch {
    return null;
  }
}

// Существующее устройство (A) кладёт свой эфемерный ключ + завёрнутый identity-ключ. Single-use: только из pending.
export async function completeLink(
  id: string,
  userId: string,
  eaPub: string,
  wrapped: string,
  nonce: string,
): Promise<boolean> {
  try {
    const redis = getRedis();
    const raw = await redis.get(key(id));
    if (!raw) return false;
    const state = JSON.parse(raw) as LinkState;
    if (state.userId !== userId || state.status !== 'pending') return false;
    const next: LinkState = { ...state, eaPub, wrapped, nonce, status: 'completed' };
    await redis.set(key(id), JSON.stringify(next), 'EX', TTL_SEC);
    return true;
  } catch {
    return false;
  }
}

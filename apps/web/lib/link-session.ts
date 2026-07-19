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

// Существующее устройство (A) кладёт свой эфемерный ключ. Новое устройство (B) его поллит и
// показывает SAS-код — обмен ключа переносится ТОЛЬКО после подтверждения кода (attach до complete).
export async function attachLink(id: string, userId: string, eaPub: string): Promise<boolean> {
  return patch(id, userId, (state) => (state.status === 'pending' && !state.eaPub ? { ...state, eaPub } : null));
}

// A кладёт завёрнутый identity-ключ уже ПОСЛЕ подтверждения SAS-кода. Single-use: только из pending с eaPub.
export async function completeLink(id: string, userId: string, wrapped: string, nonce: string): Promise<boolean> {
  return patch(id, userId, (state) =>
    state.status === 'pending' && state.eaPub ? { ...state, wrapped, nonce, status: 'completed' } : null,
  );
}

async function patch(id: string, userId: string, next: (s: LinkState) => LinkState | null): Promise<boolean> {
  try {
    const redis = getRedis();
    const raw = await redis.get(key(id));
    if (!raw) return false;
    const state = JSON.parse(raw) as LinkState;
    if (state.userId !== userId) return false;
    const updated = next(state);
    if (!updated) return false;
    await redis.set(key(id), JSON.stringify(updated), 'EX', TTL_SEC);
    return true;
  } catch {
    return false;
  }
}

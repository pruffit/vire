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

// Хендшейк с коммитментом (защита SAS от грайндинга сервером):
// start(commitB=hash(ebPub)) → attach(eaPub, видя только commit) → reveal(ebPub) → complete(wrapped).
export interface LinkState {
  userId: string;
  commitB: string;
  eaPub?: string;
  ebPub?: string;
  wrapped?: string;
  nonce?: string;
  status: 'pending' | 'completed';
}

// Новое устройство (B) открывает сессию КОММИТМЕНТОМ к своему эфемерному ключу (не самим ключом).
export async function startLink(userId: string, commitB: string): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    const state: LinkState = { userId, commitB, status: 'pending' };
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

// Существующее устройство (A) кладёт свой эфемерный ключ, видя только коммитмент B (не ebPub).
export async function attachLink(id: string, userId: string, eaPub: string): Promise<boolean> {
  return patch(id, userId, (state) => (state.status === 'pending' && !state.eaPub ? { ...state, eaPub } : null));
}

// Новое устройство (B) раскрывает ebPub уже после attach — A проверит hash(ebPub)==commitB.
export async function revealLink(id: string, userId: string, ebPub: string): Promise<boolean> {
  return patch(id, userId, (state) =>
    state.status === 'pending' && state.eaPub && !state.ebPub ? { ...state, ebPub } : null,
  );
}

// A кладёт завёрнутый identity-ключ уже ПОСЛЕ подтверждения SAS-кода. Single-use: только из pending с ebPub.
export async function completeLink(id: string, userId: string, wrapped: string, nonce: string): Promise<boolean> {
  return patch(id, userId, (state) =>
    state.status === 'pending' && state.ebPub ? { ...state, wrapped, nonce, status: 'completed' } : null,
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

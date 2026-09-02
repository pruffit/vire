import { getRedis } from './redis';

const TTL_SEC = 300;

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

// Явный отказ от привязки (SAS не сошёлся / отмена) — снимает B с TTL-ожидания сразу, не через 5 минут.
export async function abortLink(id: string, userId: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const raw = await redis.get(key(id));
    if (!raw) return false;
    const state = JSON.parse(raw) as LinkState;
    if (state.userId !== userId) return false;
    await redis.del(key(id));
    return true;
  } catch {
    return false;
  }
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

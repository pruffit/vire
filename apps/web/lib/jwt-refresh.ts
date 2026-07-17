export const JWT_ROLE_REFRESH_MS = 5 * 60 * 1000;

export interface RefreshedUser {
  role: string;
  name: string | null;
  image: string | null;
}

export interface JwtLike {
  id?: string;
  role?: string;
  name?: string | null;
  picture?: string | null;
  syncedAt?: number;
}

export interface JwtUser {
  id: string;
  role: string;
}

export function shouldRefreshRole(token: JwtLike, now: number, ttlMs: number = JWT_ROLE_REFRESH_MS): boolean {
  if (typeof token.syncedAt !== 'number') return true;
  return now - token.syncedAt > ttlMs;
}

export function isNodeRuntime(): boolean {
  return typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime === 'undefined';
}

export interface JwtDeps {
  now: number;
  isNode: boolean;
  loadUser: (id: string) => Promise<RefreshedUser | null>;
  ttlMs?: number;
}

// Мутирует token на месте и возвращает его.
// - Свежий логин (user есть): пишем id/role + syncedAt.
// - Иначе: перечитываем роль/имя/аватар из БД не чаще раза в TTL и только в Node
//   (edge-middleware БД недоступна → refresh пропускаем, токену доверяем).
// syncedAt двигаем при ЛЮБОМ реальном обращении к БД (успех / юзер удалён / ошибка),
// чтобы просадка БД не превращалась в рефетч на каждый запрос — повтор не раньше TTL.
export async function applyJwt(token: JwtLike, user: JwtUser | undefined, deps: JwtDeps): Promise<JwtLike> {
  if (user) {
    token.id = user.id;
    token.role = user.role;
    token.syncedAt = deps.now;
    return token;
  }

  if (!token.id || !deps.isNode) return token;
  if (!shouldRefreshRole(token, deps.now, deps.ttlMs)) return token;

  try {
    const fresh = await deps.loadUser(token.id);
    if (fresh) {
      token.role = fresh.role;
      token.name = fresh.name;
      token.picture = fresh.image;
    }
  } catch {
    // БД недоступна — оставляем роль/имя старыми (деградация к прежнему поведению)
  }
  token.syncedAt = deps.now;
  return token;
}

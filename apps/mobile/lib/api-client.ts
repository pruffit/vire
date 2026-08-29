import { request, type ApiResult, type RequestOptions } from '@vire/api-client';
import { tokenPairSchema } from '@vire/api-contracts';
import { API_BASE_URL } from './env';
import { getStored, setAuthTokens, clearAuthTokens } from './secure-store';
import { emitSessionExpired } from './session-events';

// Один рефреш на несколько параллельных 401 — не гонять /auth/refresh N раз подряд.
let refreshInFlight: Promise<boolean> | null = null;

// Провал рефреша означает конец сессии, а не единичную ошибку запроса: восстановить её
// клиент уже ничем не может. Сообщаем событием (см. lib/session-events.ts) — иначе
// приложение остаётся на месте и показывает ошибку на каждом экране.
async function performRefresh(): Promise<boolean> {
  const refreshToken = await getStored('refreshToken');
  if (!refreshToken) {
    emitSessionExpired();
    return false;
  }

  const result = await request(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    schema: tokenPairSchema,
    body: { refreshToken },
  });

  if (!result.ok) {
    await clearAuthTokens();
    emitSessionExpired();
    return false;
  }

  await setAuthTokens(result.data);
  return true;
}

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const accessToken = await getStored('accessToken');
  return { ...extra, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) };
}

/**
 * Единый клиент для авторизованных запросов: подставляет Bearer из secure store,
 * на 401 один раз гоняет /api/v1/auth/refresh и повторяет исходный запрос.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions<T>,
): Promise<ApiResult<T>> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const first = await request(url, { ...options, headers: await authHeaders(options.headers) });
  if (first.ok || first.error.status !== 401) return first;

  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  const refreshed = await refreshInFlight;
  if (!refreshed) return first;

  return request(url, { ...options, headers: await authHeaders(options.headers) });
}

import { okResponseSchema, getKeyResponseSchema } from '@vire/api-contracts';
import { apiRequest } from '../api-client';

/**
 * Ключ, который сервер сейчас считает ключом пользователя. `null` — ключа нет,
 * `undefined` — узнать не удалось (сеть/ошибка): это РАЗНЫЕ случаи, и вызывающий код
 * обязан их различать, иначе «не смогли проверить» превратится в «можно публиковать».
 */
export async function fetchIdentityKey(userId: string): Promise<string | null | undefined> {
  const result = await apiRequest(`/api/v1/keys?userId=${encodeURIComponent(userId)}`, {
    schema: getKeyResponseSchema,
  });
  return result.ok ? result.data.ikPub : undefined;
}

// Idempotent, safe to call repeatedly (mirrors web's E2eeBootstrap/publishPub,
// apps/web/lib/e2ee-client.ts) — dedupes by pubB64 so re-mounts/re-logins with the same
// identity don't re-POST. Not cached on failure, so a later call retries.
const published = new Set<string>();

export async function publishIdentityKey(ikPub: string): Promise<boolean> {
  if (published.has(ikPub)) return true;

  const result = await apiRequest('/api/v1/keys', {
    method: 'POST',
    schema: okResponseSchema,
    body: { ikPub },
  });

  if (result.ok) published.add(ikPub);
  return result.ok;
}

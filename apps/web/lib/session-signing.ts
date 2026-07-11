import { hmacSign, hmacVerify } from '@vire/core/signing';
import { getSigningSecret } from './app-secret';

const PURPOSE = 'session';

/** Верхняя граница длины: uuid (36) + '.' + 32-символьная hex-подпись. */
export const SESSION_ID_MAX_LEN = 80;

/** Подписывает id HMAC'ом: `${id}.${sig}`. Без секрета в env — id как есть (деградация до неподписанного поведения, ничего не ломается). */
export function signSessionId(id: string): string {
  const secret = getSigningSecret();
  if (!secret) return id;
  return `${id}.${hmacSign(secret, `${PURPOSE}:${id}`)}`;
}

/** Проверяет подпись, возвращает исходный id или null. Без секрета в env — пропускает как есть: та же деградация, что в signSessionId (нечего проверять). */
export function verifySessionId(raw: string): string | null {
  const secret = getSigningSecret();
  if (!secret) return raw;

  const dot = raw.lastIndexOf('.');
  if (dot < 0) return null;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!id || !sig) return null;
  return hmacVerify(secret, `${PURPOSE}:${id}`, sig) ? id : null;
}

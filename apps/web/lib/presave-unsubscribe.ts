import { hmacSign, hmacVerify } from '@vire/core/signing';
import { getSigningSecret } from './app-secret';

const PURPOSE = 'presave-unsub';

/**
 * Ссылка отписки от гостевых пресейв-писем — HMAC-подписанный email, без
 * отдельной таблицы токенов. Без секрета в env отписка недоступна (возвращает
 * null — воркер просто не вставит ссылку в письмо): в отличие от sessionId,
 * тут деградация в сторону "разрешить всем" была бы дырой, а не косметикой.
 */
export function signUnsubscribeToken(email: string): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  return hmacSign(secret, `${PURPOSE}:${email}`);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const secret = getSigningSecret();
  if (!secret) return false;
  return hmacVerify(secret, `${PURPOSE}:${email}`, token);
}

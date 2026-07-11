import { hmacSign, hmacVerify } from '@vire/core/signing';
import { getSigningSecret } from './app-secret';

const PURPOSE = 'presave-unsub';

/** HMAC-подписанная ссылка отписки (без таблицы токенов). Без секрета в env — null: деградация "разрешить всем" тут была бы дырой, не косметикой. */
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

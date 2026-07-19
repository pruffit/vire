import { signNotifyUnsub as sign, verifyNotifyUnsub as verify } from '@vire/core/notifications/unsubscribe';
import { getSigningSecret } from './app-secret';

export function signNotifyUnsub(userId: string): string | null {
  const secret = getSigningSecret();
  return secret ? sign(secret, userId) : null;
}

export function verifyNotifyUnsub(userId: string, token: string): boolean {
  const secret = getSigningSecret();
  return secret ? verify(secret, userId, token) : false;
}

import { verifyNotifyUnsub as verify } from '@vire/core/notifications/unsubscribe';
import { getSigningSecret } from './app-secret';

export function verifyNotifyUnsub(userId: string, token: string): boolean {
  const secret = getSigningSecret();
  return secret ? verify(secret, userId, token) : false;
}

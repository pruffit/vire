import { hmacSign, hmacVerify } from '../util/signing';

const PURPOSE = 'notify-email-unsub';

export function signNotifyUnsub(secret: string, userId: string): string {
  return hmacSign(secret, `${PURPOSE}:${userId}`);
}

export function verifyNotifyUnsub(secret: string, userId: string, token: string): boolean {
  return hmacVerify(secret, `${PURPOSE}:${userId}`, token);
}

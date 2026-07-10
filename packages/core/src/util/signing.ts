import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 подпись строки (усечена до 128 бит — довольно для анти-спуфинга
 * sessionId/ссылок отписки, не для защиты денег). Общая утилита для web (Next
 * route handlers) и worker (генерация ссылок в письмах) — оба на Node, не браузер.
 */
export function hmacSign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
}

/** Константное по времени сравнение — не через ===, чтобы не течь через тайминг. */
export function hmacVerify(secret: string, payload: string, signature: string): boolean {
  const expected = hmacSign(secret, payload);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

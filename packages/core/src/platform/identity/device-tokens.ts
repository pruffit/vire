import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { err, ok, type Result } from '../../errors';

// Токены устройства для нативных клиентов. Веб продолжает жить на cookie-сессии.
// Модуль не в корневом barrel: node:crypto недоступен в edge-runtime (как util/signing).

export const ACCESS_TOKEN_TTL_SEC = 15 * 60;
export const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;
export const REFRESH_TOKEN_BYTES = 32;

export interface AccessTokenPayload {
  /** userId */
  sub: string;
  role: string;
  /** deviceId — по нему отзывается доступ */
  did: string;
  iat: number;
  exp: number;
}

export type AccessTokenError = 'malformed' | 'bad-signature' | 'expired';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function signAccessToken(
  secret: string,
  payload: Omit<AccessTokenPayload, 'iat' | 'exp'>,
  nowMs: number,
  ttlSec: number = ACCESS_TOKEN_TTL_SEC,
): string {
  const iat = Math.floor(nowMs / 1000);
  const full: AccessTokenPayload = { ...payload, iat, exp: iat + ttlSec };
  const body = base64url(JSON.stringify(full));
  return `${body}.${sign(secret, body)}`;
}

export function verifyAccessToken(
  secret: string,
  token: string,
  nowMs: number,
): Result<AccessTokenPayload, AccessTokenError> {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return err('malformed');
  const [body, signature] = parts as [string, string];

  const expected = sign(secret, body);
  // Константное сравнение: иначе подпись подбирается по таймингу.
  if (expected.length !== signature.length) return err('bad-signature');
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return err('bad-signature');

  let payload: AccessTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AccessTokenPayload;
  } catch {
    return err('malformed');
  }
  if (typeof payload?.sub !== 'string' || typeof payload?.did !== 'string' || typeof payload?.exp !== 'number') {
    return err('malformed');
  }
  if (payload.exp * 1000 <= nowMs) return err('expired');

  return ok(payload);
}

export type RandomBytes = (size: number) => Uint8Array;

/** Refresh — непрозрачная случайная строка: смысла в её содержимом нет, проверка только по хранимому хэшу. */
export function newRefreshToken(randomBytes: RandomBytes): string {
  return Buffer.from(randomBytes(REFRESH_TOKEN_BYTES)).toString('base64url');
}

/** В БД лежит только хэш: утечка таблицы устройств не даёт войти. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshExpiresAt(nowMs: number, ttlSec: number = REFRESH_TOKEN_TTL_SEC): Date {
  return new Date(nowMs + ttlSec * 1000);
}

/** Bearer из заголовка Authorization; null — заголовка нет или он не Bearer. */
export function bearerFromHeader(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

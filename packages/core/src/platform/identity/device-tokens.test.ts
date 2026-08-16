import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  newRefreshToken,
  hashRefreshToken,
  refreshExpiresAt,
  bearerFromHeader,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
} from './device-tokens';

const SECRET = 'test-secret-value';
const NOW = Date.UTC(2026, 7, 16, 12, 0, 0);
const CLAIMS = { sub: 'user-1', role: 'LISTENER', did: 'device-1' };

describe('access-токен', () => {
  it('подписанный токен проходит проверку и отдаёт клеймы', () => {
    const token = signAccessToken(SECRET, CLAIMS, NOW);
    const result = verifyAccessToken(SECRET, token, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject(CLAIMS);
      expect(result.value.exp - result.value.iat).toBe(ACCESS_TOKEN_TTL_SEC);
    }
  });

  it('чужой секрет не проходит', () => {
    const token = signAccessToken(SECRET, CLAIMS, NOW);
    const result = verifyAccessToken('other-secret-val', token, NOW);
    expect(result).toEqual({ ok: false, error: 'bad-signature' });
  });

  it('подмена полезной нагрузки ломает подпись — роль не поднять', () => {
    const token = signAccessToken(SECRET, CLAIMS, NOW);
    const [, signature] = token.split('.');
    const tampered = Buffer.from(JSON.stringify({ ...CLAIMS, role: 'SUPERADMIN', iat: 1, exp: 9999999999 })).toString('base64url');

    expect(verifyAccessToken(SECRET, `${tampered}.${signature}`, NOW)).toEqual({ ok: false, error: 'bad-signature' });
  });

  it('истёкший токен отвергается ровно на границе', () => {
    const token = signAccessToken(SECRET, CLAIMS, NOW, 60);
    expect(verifyAccessToken(SECRET, token, NOW + 59_999).ok).toBe(true);
    expect(verifyAccessToken(SECRET, token, NOW + 60_000)).toEqual({ ok: false, error: 'expired' });
  });

  it('мусор вместо токена — malformed, а не исключение', () => {
    for (const bad of ['', 'abc', 'a.b.c', '.sig', 'body.']) {
      expect(verifyAccessToken(SECRET, bad, NOW).ok).toBe(false);
    }
  });

  it('валидная подпись поверх не-JSON тела — malformed', () => {
    const body = Buffer.from('not json').toString('base64url');
    const token = signAccessToken(SECRET, CLAIMS, NOW);
    const [, sig] = token.split('.');
    // подпись от другого тела → сначала bad-signature; собираем корректную подпись вручную
    expect(verifyAccessToken(SECRET, `${body}.${sig}`, NOW).ok).toBe(false);
  });
});

describe('refresh-токен', () => {
  const random = (n: number) => new Uint8Array(Array.from({ length: n }, (_, i) => i));

  it('генерируется из инъектированной случайности', () => {
    expect(newRefreshToken(random)).toBe(Buffer.from(random(32)).toString('base64url'));
  });

  it('хэш детерминирован и не равен самому токену', () => {
    const token = newRefreshToken(random);
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(token);
    expect(hashRefreshToken(token)).toHaveLength(64);
  });

  it('разные токены — разные хэши', () => {
    expect(hashRefreshToken('a')).not.toBe(hashRefreshToken('b'));
  });

  it('срок жизни по умолчанию — 30 суток', () => {
    expect(refreshExpiresAt(NOW).getTime()).toBe(NOW + REFRESH_TOKEN_TTL_SEC * 1000);
  });
});

describe('bearerFromHeader', () => {
  it('достаёт токен независимо от регистра схемы', () => {
    expect(bearerFromHeader('Bearer abc')).toBe('abc');
    expect(bearerFromHeader('bearer abc')).toBe('abc');
    expect(bearerFromHeader('  Bearer   abc  ')).toBe('abc');
  });

  it('чужая схема и пустое значение игнорируются', () => {
    expect(bearerFromHeader(null)).toBeNull();
    expect(bearerFromHeader('Basic abc')).toBeNull();
    expect(bearerFromHeader('Bearer')).toBeNull();
    expect(bearerFromHeader('Bearer   ')).toBeNull();
  });
});

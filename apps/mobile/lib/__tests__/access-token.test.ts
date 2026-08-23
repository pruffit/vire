import { describe, expect, it } from 'vitest';
import { decodeAccessTokenUserId } from '../access-token';

// Mirrors the real server format (packages/core/src/platform/identity/device-tokens.ts,
// signAccessToken): `base64url(JSON({sub,role,did,iat,exp})).base64url(hmac)`. The signature
// segment's actual bytes don't matter here — the client never verifies it, only reads `sub`.
function fakeAccessToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.fake-signature`;
}

describe('lib/access-token', () => {
  it('extracts sub (userId) from a well-formed token', () => {
    const token = fakeAccessToken({ sub: 'user-123', role: 'LISTENER', did: 'device-1', iat: 0, exp: 9999999999 });
    expect(decodeAccessTokenUserId(token)).toBe('user-123');
  });

  it('handles a userId containing base64url-sensitive characters via padding normalization', () => {
    // Body long enough that its base64url form lacks padding naturally — exercises the
    // '-'/'_' → '+'/'/' remap and re-padding path.
    const token = fakeAccessToken({ sub: '11111111-2222-3333-4444-555555555555', role: 'ARTIST', did: 'd', iat: 0, exp: 1 });
    expect(decodeAccessTokenUserId(token)).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('returns null for a malformed token (no dot)', () => {
    expect(decodeAccessTokenUserId('not-a-token')).toBeNull();
  });

  it('returns null for a body that is not valid base64/JSON', () => {
    expect(decodeAccessTokenUserId('%%%not-base64%%%.sig')).toBeNull();
  });

  it('returns null when sub is missing or not a string', () => {
    const token = fakeAccessToken({ role: 'LISTENER' });
    expect(decodeAccessTokenUserId(token)).toBeNull();

    const tokenBadSub = fakeAccessToken({ sub: 123 });
    expect(decodeAccessTokenUserId(tokenBadSub)).toBeNull();
  });
});

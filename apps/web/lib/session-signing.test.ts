import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signSessionId, verifySessionId, SESSION_ID_MAX_LEN } from './session-signing';

const ENV_KEYS = ['LINK_SIGNING_SECRET', 'AUTH_SECRET'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('signSessionId / verifySessionId', () => {
  it('degrades to pass-through when no secret is configured', () => {
    delete process.env.LINK_SIGNING_SECRET;
    delete process.env.AUTH_SECRET;
    const signed = signSessionId('raw-id');
    expect(signed).toBe('raw-id');
    expect(verifySessionId('raw-id')).toBe('raw-id');
  });

  it('signs and verifies a round trip when AUTH_SECRET is set', () => {
    delete process.env.LINK_SIGNING_SECRET;
    process.env.AUTH_SECRET = 'test-secret';
    const signed = signSessionId('some-uuid');
    expect(signed).not.toBe('some-uuid');
    expect(signed.startsWith('some-uuid.')).toBe(true);
    expect(signed.length).toBeLessThanOrEqual(SESSION_ID_MAX_LEN);
    expect(verifySessionId(signed)).toBe('some-uuid');
  });

  it('prefers LINK_SIGNING_SECRET over AUTH_SECRET', () => {
    process.env.LINK_SIGNING_SECRET = 'link-secret';
    process.env.AUTH_SECRET = 'auth-secret';
    const signed = signSessionId('id-1');
    process.env.LINK_SIGNING_SECRET = undefined;
    delete process.env.LINK_SIGNING_SECRET;
    // Signed with LINK_SIGNING_SECRET but only AUTH_SECRET remains — must fail.
    expect(verifySessionId(signed)).toBeNull();
  });

  it('rejects a tampered id', () => {
    process.env.AUTH_SECRET = 'test-secret';
    const signed = signSessionId('some-uuid');
    const [, sig] = signed.split('.');
    expect(verifySessionId(`other-uuid.${sig}`)).toBeNull();
  });

  it('rejects a value with no signature when a secret is configured', () => {
    process.env.AUTH_SECRET = 'test-secret';
    expect(verifySessionId('plain-id-without-signature')).toBeNull();
  });
});

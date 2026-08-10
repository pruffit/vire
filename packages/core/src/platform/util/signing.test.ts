import { describe, it, expect } from 'vitest';
import { hmacSign, hmacVerify } from './signing';

describe('hmacSign / hmacVerify', () => {
  it('verifies a signature produced for the same secret and payload', () => {
    const sig = hmacSign('secret', 'payload');
    expect(hmacVerify('secret', 'payload', sig)).toBe(true);
  });

  it('rejects a signature from a different payload', () => {
    const sig = hmacSign('secret', 'payload-a');
    expect(hmacVerify('secret', 'payload-b', sig)).toBe(false);
  });

  it('rejects a signature from a different secret', () => {
    const sig = hmacSign('secret-a', 'payload');
    expect(hmacVerify('secret-b', 'payload', sig)).toBe(false);
  });

  it('rejects a tampered/garbage signature of different length', () => {
    expect(hmacVerify('secret', 'payload', 'not-a-real-signature')).toBe(false);
  });

  it('is deterministic', () => {
    expect(hmacSign('secret', 'payload')).toBe(hmacSign('secret', 'payload'));
  });
});

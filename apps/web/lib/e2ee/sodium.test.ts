import { beforeAll, describe, expect, it } from 'vitest';
import { fromB64, fromUtf8, sodiumReady, toB64, utf8 } from './sodium';

beforeAll(async () => {
  await sodiumReady();
});

describe('sodium', () => {
  it('resolves an initialized sodium instance', async () => {
    const instance = await sodiumReady();
    expect(instance.crypto_scalarmult).toBeInstanceOf(Function);
  });

  it('round-trips base64 encoding on a known vector', () => {
    const bytes = utf8('vire e2ee');
    expect(fromB64(toB64(bytes))).toEqual(bytes);
  });

  it('round-trips utf8 encoding including cyrillic', () => {
    expect(fromUtf8(utf8('привет'))).toBe('привет');
  });
});

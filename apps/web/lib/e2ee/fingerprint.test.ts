import { beforeAll, describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers';
import { sodiumReady } from './sodium';
import { safetyNumber } from './fingerprint';

describe('e2ee/fingerprint', () => {
  beforeAll(async () => {
    await sodiumReady();
  });

  it('is symmetric in its arguments', () => {
    const a = sodium.crypto_box_keypair().publicKey;
    const b = sodium.crypto_box_keypair().publicKey;
    expect(safetyNumber(a, b)).toBe(safetyNumber(b, a));
  });

  it('renders 60 digits in 12 groups of 5', () => {
    const a = sodium.crypto_box_keypair().publicKey;
    const b = sodium.crypto_box_keypair().publicKey;
    const sn = safetyNumber(a, b);
    expect(sn).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(sn.replace(/ /g, '')).toHaveLength(60);
  });

  it('differs for different key pairs', () => {
    const a = sodium.crypto_box_keypair().publicKey;
    const b = sodium.crypto_box_keypair().publicKey;
    const c = sodium.crypto_box_keypair().publicKey;
    expect(safetyNumber(a, b)).not.toBe(safetyNumber(a, c));
  });
});

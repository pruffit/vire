import { describe, expect, it } from 'vitest';
import { deriveCK, encryptMessage, decryptMessage, toB64, fromB64 } from '../sodium-compat';

// Fixed reference vector generated with web's REAL libsodium-wrappers implementation
// (apps/web/lib/e2ee/{sodium,conversation}.ts), via a throwaway script (not committed) that
// called sodium.crypto_scalarmult_base/crypto_scalarmult/crypto_generichash/
// crypto_secretbox_easy directly with fixed, hardcoded 32-byte scalars and a fixed nonce —
// see docs/features/mobile-app.md "Инкремент 13" for the generation method and full output.
// This is the vector that proves tweetnacl+blakejs produce byte-identical output to libsodium,
// not just "internally consistent" — a subtly-wrong KDF or byte order would pass a
// random-key round-trip test but fail this one.
const VECTOR = {
  privA: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
  privB: '201f1e1d1c1b1a191817161514131211100f0e0d0c0b0a090807060504030201',
  pubA: '07a37cbc142093c8b755dc1b10e86cb426374ad16aa853ed0bdfc0b2b86d1c7c',
  pubB: '0d799600f6ffaee2e121e6b8f7a05dc66874b51db3102d0d71f799a09cb4c461',
  ck: '6143a9fa930cbea4e346b9e81a50f031ef78968c158f64341cd6387143cece4f',
  nonce: '0102030405060708090a0b0c0d0e0f101112131415161718',
  ciphertext: '3e6e59886a64415fcbd8c8f6426f0a9bab24c07caca09b73e959b910',
  plaintext: 'привет',
  ciphertextB64: 'Pm5ZiGpkQV/L2Mj2Qm8Km6skwHysoJtz6Vm5EA==',
  nonceB64: 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcY',
} as const;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('e2ee/sodium-compat cross-platform vector (tweetnacl+blakejs vs. libsodium)', () => {
  const privA = hexToBytes(VECTOR.privA);
  const privB = hexToBytes(VECTOR.privB);
  const pubA = hexToBytes(VECTOR.pubA);
  const pubB = hexToBytes(VECTOR.pubB);

  it('deriveCK matches libsodium byte-for-byte from side A', () => {
    const ck = deriveCK(privA, pubB, pubA);
    expect(bytesToHex(ck)).toBe(VECTOR.ck);
  });

  it('deriveCK matches libsodium byte-for-byte from side B (and both sides agree)', () => {
    const ck = deriveCK(privB, pubA, pubB);
    expect(bytesToHex(ck)).toBe(VECTOR.ck);
  });

  it('base64 codec matches sodium base64_variants.ORIGINAL', () => {
    const ck = hexToBytes(VECTOR.ck);
    expect(toB64(fromB64(VECTOR.nonceB64))).toBe(VECTOR.nonceB64);
    expect(fromB64(VECTOR.nonceB64)).toEqual(hexToBytes(VECTOR.nonce));
    expect(toB64(hexToBytes(VECTOR.ciphertext))).toBe(VECTOR.ciphertextB64);
    expect(ck.length).toBe(32);
  });

  it('decryptMessage recovers the exact plaintext from a ciphertext produced by real libsodium', () => {
    const ck = hexToBytes(VECTOR.ck);
    const decrypted = decryptMessage(VECTOR.ciphertextB64, VECTOR.nonceB64, ck);
    expect(decrypted).toBe(VECTOR.plaintext);
  });

  it('rejects the fixed ciphertext under a wrong key', () => {
    const wrongCk = new Uint8Array(32).fill(9);
    expect(decryptMessage(VECTOR.ciphertextB64, VECTOR.nonceB64, wrongCk)).toBeNull();
  });
});

describe('e2ee/sodium-compat round-trip (own-generated keys, sanity)', () => {
  it('deriveCK produces the same key for both sides', () => {
    const a = { publicKey: hexToBytes(VECTOR.pubA), secretKey: hexToBytes(VECTOR.privA) };
    const b = { publicKey: hexToBytes(VECTOR.pubB), secretKey: hexToBytes(VECTOR.privB) };

    const ckA = deriveCK(a.secretKey, b.publicKey, a.publicKey);
    const ckB = deriveCK(b.secretKey, a.publicKey, b.publicKey);

    expect(bytesToHex(ckA)).toBe(bytesToHex(ckB));
  });

  it('encrypts with a random nonce and decrypts back, including cyrillic', () => {
    const ck = hexToBytes(VECTOR.ck);
    const enc = encryptMessage('привет, мир!', ck);
    const decrypted = decryptMessage(enc.ciphertext, enc.nonce, ck);
    expect(decrypted).toBe('привет, мир!');
  });

  it('returns null when the ciphertext is corrupted', () => {
    const ck = hexToBytes(VECTOR.ck);
    const enc = encryptMessage('привет', ck);
    const corrupted = enc.ciphertext.slice(0, -4) + 'AAAA';
    expect(decryptMessage(corrupted, enc.nonce, ck)).toBeNull();
  });

  // Найдено живой проверкой инкремента 16: tweetnacl.secretbox.open БРОСАЕТ (не возвращает
  // null) на неверную длину nonce/ключа — в отличие от неверного содержимого, которое просто
  // не проходит аутентификацию. Регрессия на краш экрана треда/списка диалогов на битой строке.
  it('не бросает, а возвращает null при неверной длине nonce', () => {
    const ck = hexToBytes(VECTOR.ck);
    const enc = encryptMessage('привет', ck);
    const badLengthNonce = toB64(new Uint8Array(8));
    expect(() => decryptMessage(enc.ciphertext, badLengthNonce, ck)).not.toThrow();
    expect(decryptMessage(enc.ciphertext, badLengthNonce, ck)).toBeNull();
  });

  it('не бросает, а возвращает null при неверной длине ключа', () => {
    const enc = encryptMessage('привет', hexToBytes(VECTOR.ck));
    const badLengthKey = new Uint8Array(8);
    expect(() => decryptMessage(enc.ciphertext, enc.nonce, badLengthKey)).not.toThrow();
    expect(decryptMessage(enc.ciphertext, enc.nonce, badLengthKey)).toBeNull();
  });
});

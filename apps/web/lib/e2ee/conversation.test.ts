import { beforeAll, describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers';
import { sodiumReady } from './sodium';
import { deriveCK, encryptMessage, decryptMessage } from './conversation';

describe('e2ee/conversation', () => {
  beforeAll(async () => {
    await sodiumReady();
  });

  it('deriveCK produces the same key for both sides', () => {
    const a = sodium.crypto_box_keypair();
    const b = sodium.crypto_box_keypair();

    const ckA = deriveCK(a.privateKey, b.publicKey, a.publicKey);
    const ckB = deriveCK(b.privateKey, a.publicKey, b.publicKey);

    expect(toHex(ckA)).toBe(toHex(ckB));
  });

  it('encrypts with one side key and decrypts with the other, including cyrillic', () => {
    const a = sodium.crypto_box_keypair();
    const b = sodium.crypto_box_keypair();

    const ckA = deriveCK(a.privateKey, b.publicKey, a.publicKey);
    const ckB = deriveCK(b.privateKey, a.publicKey, b.publicKey);

    const enc = encryptMessage('привет', ckA);
    const decrypted = decryptMessage(enc.ciphertext, enc.nonce, ckB);

    expect(decrypted).toBe('привет');
  });

  it('returns null when the nonce is corrupted', () => {
    const a = sodium.crypto_box_keypair();
    const b = sodium.crypto_box_keypair();

    const ckA = deriveCK(a.privateKey, b.publicKey, a.publicKey);
    const ckB = deriveCK(b.privateKey, a.publicKey, b.publicKey);

    const enc = encryptMessage('привет', ckA);
    const corruptedNonce = sodium.to_base64(
      sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES),
      sodium.base64_variants.ORIGINAL,
    );

    expect(decryptMessage(enc.ciphertext, corruptedNonce, ckB)).toBeNull();
  });
});

function toHex(u8: Uint8Array): string {
  return Array.from(u8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

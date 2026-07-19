import sodium from 'libsodium-wrappers';
import { toB64, fromB64, utf8 } from './sodium';

const WRAP_KEY = utf8('vire-link-wrap-v1'); // 17 байт (в диапазоне ключа BLAKE2b 16–64)

export interface Ephemeral {
  pub: Uint8Array;
  priv: Uint8Array;
}

export function newEphemeral(): Ephemeral {
  const pair = sodium.crypto_box_keypair();
  return { pub: pair.publicKey, priv: pair.privateKey };
}

export function deriveLinkSecret(ephPrivSelf: Uint8Array, ephPubOther: Uint8Array): Uint8Array {
  return sodium.crypto_scalarmult(ephPrivSelf, ephPubOther);
}

// SAS — 6 цифр из транскрипта (эфемерные ключи B‖A ‖ S). Обе стороны подают ключи в порядке B, A.
// 6 байт хеша через Number-умножение (48 бит < 2^53, без BigInt).
export function sasDigits6(ephPubB: Uint8Array, ephPubA: Uint8Array, secret: Uint8Array): string {
  const input = new Uint8Array(ephPubB.length + ephPubA.length + secret.length);
  input.set(ephPubB, 0);
  input.set(ephPubA, ephPubB.length);
  input.set(secret, ephPubB.length + ephPubA.length);
  const h = sodium.crypto_generichash(6, input);
  let v = 0;
  for (const byte of h) v = v * 256 + byte;
  return (v % 1000000).toString().padStart(6, '0');
}

function wrapKeyFrom(secret: Uint8Array): Uint8Array {
  return sodium.crypto_generichash(32, secret, WRAP_KEY);
}

export function wrapPriv(ikPriv: Uint8Array, secret: Uint8Array): { wrapped: string; nonce: string } {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const wrapped = sodium.crypto_secretbox_easy(ikPriv, nonce, wrapKeyFrom(secret));
  return { wrapped: toB64(wrapped), nonce: toB64(nonce) };
}

export function unwrapPriv(wrapped: string, nonce: string, secret: Uint8Array): Uint8Array | null {
  try {
    return sodium.crypto_secretbox_open_easy(fromB64(wrapped), fromB64(nonce), wrapKeyFrom(secret));
  } catch {
    return null;
  }
}

import sodium from 'libsodium-wrappers';
import { toB64, fromB64, utf8, fromUtf8 } from './sodium';

// personal-ключ BLAKE2b ровно 16 байт (min keybytes) — 15-символьная метка + \0
const CK_KEY = utf8('vire-chat-ck-v1\0');

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

export function deriveCK(
  ikPrivSelf: Uint8Array,
  ikPubOther: Uint8Array,
  ikPubSelf: Uint8Array,
): Uint8Array {
  const shared = sodium.crypto_scalarmult(ikPrivSelf, ikPubOther);
  const [low, high] =
    compareBytes(ikPubSelf, ikPubOther) < 0 ? [ikPubSelf, ikPubOther] : [ikPubOther, ikPubSelf];
  return sodium.crypto_generichash(32, concat(shared, low, high), CK_KEY);
}

export function encryptMessage(
  plaintext: string,
  ck: Uint8Array,
): { ciphertext: string; nonce: string } {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const c = sodium.crypto_secretbox_easy(utf8(plaintext), nonce, ck);
  return { ciphertext: toB64(c), nonce: toB64(nonce) };
}

export function decryptMessage(ciphertext: string, nonce: string, ck: Uint8Array): string | null {
  try {
    return fromUtf8(sodium.crypto_secretbox_open_easy(fromB64(ciphertext), fromB64(nonce), ck));
  } catch {
    return null;
  }
}

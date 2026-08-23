import nacl from 'tweetnacl';
import { blake2b } from 'blakejs';
import { toB64, fromB64, utf8, fromUtf8 } from '../codec';

// Pure-JS drop-in for web's libsodium-wrappers usage (apps/web/lib/e2ee/{sodium,conversation}.ts).
// tweetnacl implements the same NaCl primitives libsodium wraps (X25519 scalarmult/scalarmult_base,
// XSalsa20-Poly1305 secretbox) — byte-identical output for identical input, proven by
// lib/e2ee/__tests__/sodium-compat.test.ts against a fixed vector generated with real libsodium.
// blakejs covers keyed BLAKE2b (crypto_generichash), which tweetnacl does not implement.

export { toB64, fromB64, utf8, fromUtf8 };

// personal-ключ BLAKE2b ровно 16 байт (min keybytes) — 15-символьная метка + \0, same as web.
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
  const shared = nacl.scalarMult(ikPrivSelf, ikPubOther);
  const [low, high] =
    compareBytes(ikPubSelf, ikPubOther) < 0 ? [ikPubSelf, ikPubOther] : [ikPubOther, ikPubSelf];
  return blake2b(concat(shared, low, high), CK_KEY, 32);
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function encryptMessage(
  plaintext: string,
  ck: Uint8Array,
): { ciphertext: string; nonce: string } {
  const nonce = randomBytes(nacl.secretbox.nonceLength);
  const c = nacl.secretbox(utf8(plaintext), nonce, ck);
  return { ciphertext: toB64(c), nonce: toB64(nonce) };
}

export function decryptMessage(ciphertext: string, nonce: string, ck: Uint8Array): string | null {
  const opened = nacl.secretbox.open(fromB64(ciphertext), fromB64(nonce), ck);
  if (!opened) return null;
  try {
    return fromUtf8(opened);
  } catch {
    return null;
  }
}

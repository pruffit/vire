import sodium from 'libsodium-wrappers';

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

// Число безопасности пары ключей: 60 цифр группами по 5, одинаковое при перестановке сторон.
export function safetyNumber(ikPubA: Uint8Array, ikPubB: Uint8Array): string {
  const [low, high] = compareBytes(ikPubA, ikPubB) < 0 ? [ikPubA, ikPubB] : [ikPubB, ikPubA];
  const input = new Uint8Array(low.length + high.length);
  input.set(low, 0);
  input.set(high, low.length);
  const hash = sodium.crypto_generichash(30, input);

  let n = 0n;
  for (const byte of hash) n = (n << 8n) | BigInt(byte);
  const digits = n.toString().padStart(60, '0').slice(-60);

  return (digits.match(/.{5}/g) ?? []).join(' ');
}

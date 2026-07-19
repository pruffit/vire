import sodium from 'libsodium-wrappers';

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

// Число безопасности пары ключей: 60 цифр группами по 5, одинаковое при перестановке сторон.
// 12 групп × 3 байта хеша → значение по модулю 100000 (Number-арифметика, без BigInt: 24 бита < 2^53).
export function safetyNumber(ikPubA: Uint8Array, ikPubB: Uint8Array): string {
  const [low, high] = compareBytes(ikPubA, ikPubB) < 0 ? [ikPubA, ikPubB] : [ikPubB, ikPubA];
  const input = new Uint8Array(low.length + high.length);
  input.set(low, 0);
  input.set(high, low.length);
  const hash = sodium.crypto_generichash(36, input);

  const groups: string[] = [];
  for (let i = 0; i < 12; i++) {
    const v = (hash[i * 3] * 256 + hash[i * 3 + 1]) * 256 + hash[i * 3 + 2];
    groups.push((v % 100000).toString().padStart(5, '0'));
  }
  return groups.join(' ');
}

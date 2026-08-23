import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import { deriveCK, encryptMessage, decryptMessage } from '../e2ee/sodium-compat';

// Проверяет полный путь `chat-thread-screen.tsx`: две личности выводят один и тот же CK,
// шифротекст с одной стороны читается на другой. Отдельно от sodium-compat.test.ts
// (который бьёт совпадение с реальным libsodium по фиксированному вектору) — здесь
// произвольные ключи, фокус на end-to-end сценарии треда, не на побитовой совместимости.
describe('chat E2EE round-trip (deriveCK + encryptMessage + decryptMessage)', () => {
  const alice = nacl.box.keyPair();
  const bob = nacl.box.keyPair();

  it('обе стороны выводят один и тот же CK', () => {
    const ckAlice = deriveCK(alice.secretKey, bob.publicKey, alice.publicKey);
    const ckBob = deriveCK(bob.secretKey, alice.publicKey, bob.publicKey);
    expect(Array.from(ckAlice)).toEqual(Array.from(ckBob));
  });

  it('сообщение, зашифрованное Алисой, читается Бобом', () => {
    const ckAlice = deriveCK(alice.secretKey, bob.publicKey, alice.publicKey);
    const ckBob = deriveCK(bob.secretKey, alice.publicKey, bob.publicKey);

    const { ciphertext, nonce } = encryptMessage('тест инкремент 14', ckAlice);
    expect(decryptMessage(ciphertext, nonce, ckBob)).toBe('тест инкремент 14');
  });

  it('кириллица переживает round-trip побайтово', () => {
    const ckAlice = deriveCK(alice.secretKey, bob.publicKey, alice.publicKey);
    const ckBob = deriveCK(bob.secretKey, alice.publicKey, bob.publicKey);

    const { ciphertext, nonce } = encryptMessage('привет от друга', ckBob);
    expect(decryptMessage(ciphertext, nonce, ckAlice)).toBe('привет от друга');
  });

  it('чужим CK сообщение не читается', () => {
    const ckAlice = deriveCK(alice.secretKey, bob.publicKey, alice.publicKey);
    const stranger = nacl.box.keyPair();
    const ckStranger = deriveCK(stranger.secretKey, bob.publicKey, stranger.publicKey);

    const { ciphertext, nonce } = encryptMessage('секрет', ckAlice);
    expect(decryptMessage(ciphertext, nonce, ckStranger)).toBeNull();
  });
});

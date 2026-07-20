import 'fake-indexeddb/auto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers';
import { sodiumReady, toB64 } from './sodium';
import {
  clearIdentity,
  getIdentity,
  getIdentityPubB64,
  getOrCreateIdentity,
  importIdentity,
} from './identity';

const USER_A = 'user-a';
const USER_B = 'user-b';

describe('e2ee/identity', () => {
  beforeAll(async () => {
    await sodiumReady();
  });

  afterEach(async () => {
    await clearIdentity(USER_A);
    await clearIdentity(USER_B);
  });

  it('generates and persists an identity keypair with a 32-byte public key', async () => {
    const identity = await getOrCreateIdentity(USER_A);
    expect(identity.pub).toHaveLength(32);
    expect(identity.priv).toHaveLength(32);
  });

  it('returns the same keypair on repeated calls', async () => {
    const first = await getOrCreateIdentity(USER_A);
    const second = await getOrCreateIdentity(USER_A);
    expect(toB64(second.pub)).toBe(toB64(first.pub));
    expect(toB64(second.priv)).toBe(toB64(first.priv));
  });

  it('returns null after clearing', async () => {
    await getOrCreateIdentity(USER_A);
    await clearIdentity(USER_A);
    expect(await getIdentity(USER_A)).toBeNull();
  });

  it('returns null when nothing was ever stored', async () => {
    expect(await getIdentity(USER_A)).toBeNull();
  });

  it('imports a given private key and derives the matching public key', async () => {
    const keypair = sodium.crypto_box_keypair();
    await importIdentity(USER_A, keypair.privateKey);

    const stored = await getIdentity(USER_A);
    expect(stored).not.toBeNull();
    expect(toB64(stored!.priv)).toBe(toB64(keypair.privateKey));
    expect(toB64(stored!.pub)).toBe(toB64(sodium.crypto_scalarmult_base(keypair.privateKey)));
  });

  it('exposes the stored public key as base64, or null when absent', async () => {
    expect(await getIdentityPubB64(USER_A)).toBeNull();

    const identity = await getOrCreateIdentity(USER_A);
    expect(await getIdentityPubB64(USER_A)).toBe(toB64(identity.pub));
  });

  it('личность юзера A недоступна юзеру B на общем браузере, и наоборот', async () => {
    const identityA = await getOrCreateIdentity(USER_A);
    expect(await getIdentity(USER_B)).toBeNull();

    const identityB = await getOrCreateIdentity(USER_B);
    expect(toB64(identityB.pub)).not.toBe(toB64(identityA.pub));

    const reReadA = await getIdentity(USER_A);
    expect(toB64(reReadA!.pub)).toBe(toB64(identityA.pub));
  });
});

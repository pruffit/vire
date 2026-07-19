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

describe('e2ee/identity', () => {
  beforeAll(async () => {
    await sodiumReady();
  });

  afterEach(async () => {
    await clearIdentity();
  });

  it('generates and persists an identity keypair with a 32-byte public key', async () => {
    const identity = await getOrCreateIdentity();
    expect(identity.pub).toHaveLength(32);
    expect(identity.priv).toHaveLength(32);
  });

  it('returns the same keypair on repeated calls', async () => {
    const first = await getOrCreateIdentity();
    const second = await getOrCreateIdentity();
    expect(toB64(second.pub)).toBe(toB64(first.pub));
    expect(toB64(second.priv)).toBe(toB64(first.priv));
  });

  it('returns null after clearing', async () => {
    await getOrCreateIdentity();
    await clearIdentity();
    expect(await getIdentity()).toBeNull();
  });

  it('returns null when nothing was ever stored', async () => {
    expect(await getIdentity()).toBeNull();
  });

  it('imports a given private key and derives the matching public key', async () => {
    const keypair = sodium.crypto_box_keypair();
    await importIdentity(keypair.privateKey);

    const stored = await getIdentity();
    expect(stored).not.toBeNull();
    expect(toB64(stored!.priv)).toBe(toB64(keypair.privateKey));
    expect(toB64(stored!.pub)).toBe(toB64(sodium.crypto_scalarmult_base(keypair.privateKey)));
  });

  it('exposes the stored public key as base64, or null when absent', async () => {
    expect(await getIdentityPubB64()).toBeNull();

    const identity = await getOrCreateIdentity();
    expect(await getIdentityPubB64()).toBe(toB64(identity.pub));
  });
});

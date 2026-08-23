import { describe, expect, it, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) => Promise.resolve(store.get(key) ?? null),
  setItemAsync: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  deleteItemAsync: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

import { getIdentity, getOrCreateIdentity, clearIdentity, getIdentityPubB64 } from '../identity';

beforeEach(() => {
  store.clear();
});

describe('e2ee/identity', () => {
  it('getIdentity returns null when nothing is stored', async () => {
    expect(await getIdentity('user-1')).toBeNull();
  });

  it('getOrCreateIdentity generates a keypair on first call and persists it', async () => {
    const identity = await getOrCreateIdentity('user-1');
    expect(identity.pub).toBeInstanceOf(Uint8Array);
    expect(identity.priv).toBeInstanceOf(Uint8Array);
    expect(identity.pub.length).toBe(32);
    expect(identity.priv.length).toBe(32);

    const stored = await getIdentity('user-1');
    expect(stored).toEqual(identity);
  });

  it('getOrCreateIdentity returns the same identity on repeated calls (no regeneration)', async () => {
    const first = await getOrCreateIdentity('user-1');
    const second = await getOrCreateIdentity('user-1');
    expect(second).toEqual(first);
  });

  it('scopes identities by userId — two users on the same device store don\'t collide', async () => {
    const a = await getOrCreateIdentity('user-a');
    const b = await getOrCreateIdentity('user-b');
    expect(a).not.toEqual(b);
    expect(await getIdentity('user-a')).toEqual(a);
    expect(await getIdentity('user-b')).toEqual(b);
  });

  it('clearIdentity removes the stored identity for that user only', async () => {
    await getOrCreateIdentity('user-a');
    await getOrCreateIdentity('user-b');

    await clearIdentity('user-a');

    expect(await getIdentity('user-a')).toBeNull();
    expect(await getIdentity('user-b')).not.toBeNull();
  });

  it('getIdentityPubB64 returns base64 of the public key, null if absent', async () => {
    expect(await getIdentityPubB64('user-1')).toBeNull();

    const identity = await getOrCreateIdentity('user-1');
    const pubB64 = await getIdentityPubB64('user-1');

    expect(pubB64).not.toBeNull();
    expect(typeof pubB64).toBe('string');
    // Standard base64 of 32 bytes: 43 chars + one '=' pad, per apps/web/app/api/v1/keys/route.ts's schema.
    expect(pubB64).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    void identity;
  });

  it('uses a SecureStore key without a colon (expo-secure-store forbids it, unlike web IndexedDB)', async () => {
    await getOrCreateIdentity('11111111-2222-3333-4444-555555555555');
    const keys = Array.from(store.keys());
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain(':');
    expect(keys[0]).toMatch(/^[\w.-]+$/);
  });
});

import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { toB64, fromB64 } from '../codec';

export interface Identity {
  pub: Uint8Array;
  priv: Uint8Array;
}

// Web scopes the identity by `identity:{userId}` in IndexedDB (docs/features/chat.md) — same
// scoping intent here, but expo-secure-store keys must match /^[\w.-]+$/ (no colon allowed).
function keyFor(userId: string): string {
  return `vire_identity_${userId}`;
}

// SecureStore values are strings only — pub/priv packed as "pubB64.privB64" ('.' is outside
// the base64 alphabet, safe as a delimiter).
function serialize(identity: Identity): string {
  return `${toB64(identity.pub)}.${toB64(identity.priv)}`;
}

function deserialize(value: string): Identity | null {
  const [pubB64, privB64] = value.split('.');
  if (!pubB64 || !privB64) return null;
  return { pub: fromB64(pubB64), priv: fromB64(privB64) };
}

export async function getIdentity(userId: string): Promise<Identity | null> {
  const value = await SecureStore.getItemAsync(keyFor(userId));
  return value ? deserialize(value) : null;
}

// Single-device only this increment: no importIdentity/resetIdentity/device-linking yet
// (deferred — see docs/features/mobile-app.md "Инкремент 13").
export async function getOrCreateIdentity(userId: string): Promise<Identity> {
  const existing = await getIdentity(userId);
  if (existing) return existing;
  const pair = nacl.box.keyPair();
  const identity: Identity = { pub: pair.publicKey, priv: pair.secretKey };
  await SecureStore.setItemAsync(keyFor(userId), serialize(identity));
  return identity;
}

export async function clearIdentity(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(keyFor(userId));
}

export async function getIdentityPubB64(userId: string): Promise<string | null> {
  const identity = await getIdentity(userId);
  return identity ? toB64(identity.pub) : null;
}

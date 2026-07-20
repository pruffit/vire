import sodium from 'libsodium-wrappers';
import { toB64 } from './sodium';

export interface Identity {
  pub: Uint8Array;
  priv: Uint8Array;
}

const DB_NAME = 'vire-e2ee';
const STORE = 'keys';

function keyFor(userId: string): string {
  return `identity:${userId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function getIdentity(userId: string): Promise<Identity | null> {
  const value = await tx<Identity | undefined>('readonly', (s) => s.get(keyFor(userId)));
  return value ?? null;
}

export async function getOrCreateIdentity(userId: string): Promise<Identity> {
  const existing = await getIdentity(userId);
  if (existing) return existing;
  const pair = sodium.crypto_box_keypair();
  const identity: Identity = { pub: pair.publicKey, priv: pair.privateKey };
  await tx('readwrite', (s) => s.put(identity, keyFor(userId)));
  return identity;
}

export async function importIdentity(userId: string, priv: Uint8Array): Promise<void> {
  const identity: Identity = { pub: sodium.crypto_scalarmult_base(priv), priv };
  await tx('readwrite', (s) => s.put(identity, keyFor(userId)));
}

export async function clearIdentity(userId: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(keyFor(userId)));
}

// Явный сброс: в отличие от getOrCreateIdentity, всегда создаёт новую пару, даже если
// локальная личность уже есть (сценарий needsLink-тупика: старую переписку не спасти).
export async function resetIdentity(userId: string): Promise<Identity> {
  const pair = sodium.crypto_box_keypair();
  const identity: Identity = { pub: pair.publicKey, priv: pair.privateKey };
  await tx('readwrite', (s) => s.put(identity, keyFor(userId)));
  return identity;
}

export async function getIdentityPubB64(userId: string): Promise<string | null> {
  const identity = await getIdentity(userId);
  return identity ? toB64(identity.pub) : null;
}

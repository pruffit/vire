import sodium from 'libsodium-wrappers';
import { toB64 } from './sodium';

export interface Identity {
  pub: Uint8Array;
  priv: Uint8Array;
}

const DB_NAME = 'vire-e2ee';
const STORE = 'keys';
const KEY = 'identity';

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

export async function getIdentity(): Promise<Identity | null> {
  const value = await tx<Identity | undefined>('readonly', (s) => s.get(KEY));
  return value ?? null;
}

export async function getOrCreateIdentity(): Promise<Identity> {
  const existing = await getIdentity();
  if (existing) return existing;
  const pair = sodium.crypto_box_keypair();
  const identity: Identity = { pub: pair.publicKey, priv: pair.privateKey };
  await tx('readwrite', (s) => s.put(identity, KEY));
  return identity;
}

export async function importIdentity(priv: Uint8Array): Promise<void> {
  const identity: Identity = { pub: sodium.crypto_scalarmult_base(priv), priv };
  await tx('readwrite', (s) => s.put(identity, KEY));
}

export async function clearIdentity(): Promise<void> {
  await tx('readwrite', (s) => s.delete(KEY));
}

export async function getIdentityPubB64(): Promise<string | null> {
  const identity = await getIdentity();
  return identity ? toB64(identity.pub) : null;
}

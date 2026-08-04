import type { PlayerTrack } from '@/store/player';
import { releaseAllOfflineCoverUrls } from './cover-url';

const DB_NAME = 'vire-offline';
const STORE = 'tracks';

export interface OfflineTrack extends Pick<PlayerTrack, 'id' | 'title' | 'artistName' | 'coverUrl' | 'artistSlug' | 'releaseId' | 'isExplicit' | 'version'> {
  durationSec?: number;
  // Обложка живёт на CDN (чужой origin), а SW такие картинки намеренно не перехватывает —
  // без собственной копии офлайн-экран и плеер показывали бы битую картинку.
  coverBlob?: Blob;
  hlsUrl: string;
  segmentUrls: string[];
  bytes: number;
  addedAt: number;
  status: 'partial' | 'done';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
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

export async function getTrack(id: string): Promise<OfflineTrack | null> {
  const value = await tx<OfflineTrack | undefined>('readonly', (s) => s.get(id));
  return value ?? null;
}

export function getAllTracks(): Promise<OfflineTrack[]> {
  return tx<OfflineTrack[]>('readonly', (s) => s.getAll());
}

export async function putTrack(track: OfflineTrack): Promise<void> {
  await tx('readwrite', (s) => s.put(track));
}

export async function deleteTrack(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

// Держать синхронно с OFFLINE_CACHE в lib/offline/download.ts и public/sw.js.
const OFFLINE_CACHE_NAME = 'vire-offline-v1';

export async function purgeOfflineLibrary(): Promise<void> {
  releaseAllOfflineCoverUrls();
  await caches.delete(OFFLINE_CACHE_NAME);
  await tx<undefined>('readwrite', (s) => s.clear());
}

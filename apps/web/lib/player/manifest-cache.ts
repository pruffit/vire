export interface ManifestData {
  hlsUrl: string;
  waveformPeaks: number[] | null;
}

const CACHE_LIMIT = 10;

// Map сохраняет порядок вставки — используем это для LRU (перестановка ключа в
// конец при чтении, вытеснение первого ключа при переполнении).
const cache = new Map<string, ManifestData>();

export function getCachedManifest(trackId: string): ManifestData | undefined {
  const hit = cache.get(trackId);
  if (!hit) return undefined;
  cache.delete(trackId);
  cache.set(trackId, hit);
  return hit;
}

export function putCachedManifest(trackId: string, data: ManifestData): void {
  cache.delete(trackId);
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(trackId, data);
}

// In-flight дедуп: префетч и attachAndPlay могут спросить один trackId одновременно —
// второй вызов присоединяется к летящему промису вместо второго сетевого запроса.
const inFlight = new Map<string, Promise<ManifestData | null>>();

/** Манифест текущего/префетчимого трека — через LRU-кэш, без повторных сетевых запросов. */
export function fetchManifest(trackId: string): Promise<ManifestData | null> {
  const cached = getCachedManifest(trackId);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(trackId);
  if (pending) return pending;

  const request = (async (): Promise<ManifestData | null> => {
    const res = await fetch(`/api/v1/tracks/${trackId}/manifest`).catch(() => null);
    if (!res?.ok) return null;

    // Битый JSON при 200 идёт по тому же error-пути (null), не unhandled rejection.
    const data = (await res.json().catch(() => null)) as ManifestData | null;
    if (!data) return null;
    putCachedManifest(trackId, data);
    return data;
  })().finally(() => {
    inFlight.delete(trackId);
  });

  inFlight.set(trackId, request);
  return request;
}

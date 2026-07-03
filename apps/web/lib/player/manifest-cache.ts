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

/** Манифест текущего/префетчимого трека — через LRU-кэш, без повторных сетевых запросов. */
export async function fetchManifest(trackId: string): Promise<ManifestData | null> {
  const cached = getCachedManifest(trackId);
  if (cached) return cached;

  const res = await fetch(`/api/v1/tracks/${trackId}/manifest`).catch(() => null);
  if (!res?.ok) return null;

  const data = (await res.json()) as ManifestData;
  putCachedManifest(trackId, data);
  return data;
}

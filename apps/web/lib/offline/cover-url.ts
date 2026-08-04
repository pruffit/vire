import type { OfflineTrack } from './db';

// Object URL живёт до явного revoke: плеер продолжает играть после ухода с экрана
// «Скачанное», поэтому ссылку держим на уровне модуля, а не компонента.
const urls = new Map<string, string>();

export function offlineCoverUrl(track: Pick<OfflineTrack, 'id' | 'coverUrl' | 'coverBlob'>): string | null {
  if (!track.coverBlob) return track.coverUrl;
  const cached = urls.get(track.id);
  if (cached) return cached;
  const url = URL.createObjectURL(track.coverBlob);
  urls.set(track.id, url);
  return url;
}

export function releaseOfflineCoverUrl(trackId: string): void {
  const url = urls.get(trackId);
  if (!url) return;
  URL.revokeObjectURL(url);
  urls.delete(trackId);
}

export function releaseAllOfflineCoverUrls(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}

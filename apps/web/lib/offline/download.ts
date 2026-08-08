import { parseHlsSegments } from './hls';
import { getTrack, putTrack, deleteTrack, type OfflineTrack } from './db';
import { releaseOfflineCoverUrl } from './cover-url';

// Держать синхронно с OFFLINE_CACHE в public/sw.js — расхождение имени рвёт офлайн-раздачу SW.
export const OFFLINE_CACHE = 'vire-offline-v1';
const CONCURRENCY = 4;

export type DownloadMeta = Pick<
  OfflineTrack,
  'id' | 'title' | 'artistName' | 'coverUrl' | 'artistSlug' | 'releaseId' | 'isExplicit' | 'version' | 'durationSec'
>;

export interface DownloadOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export function planDownload(segmentUrls: string[], cachedUrls: string[]): string[] {
  const cached = new Set(cachedUrls);
  return segmentUrls.filter((url) => !cached.has(url));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

async function cachePut(cache: Cache, key: string, response: Response): Promise<ArrayBuffer> {
  const clone = response.clone();
  await cache.put(key, response);
  return clone.arrayBuffer();
}

// Content-Length избавляет от чтения тела в память ради одного числа — критично для
// сегментов, которые качаются пачками параллельно. Фолбэк на буфер, если заголовка нет.
async function cachePutSized(cache: Cache, key: string, response: Response): Promise<number> {
  const contentLength = Number(response.headers?.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 0) {
    await cache.put(key, response);
    return contentLength;
  }
  const buf = await cachePut(cache, key, response);
  return buf.byteLength;
}

function manifestUrlFor(trackId: string): string {
  return `/api/v1/tracks/${trackId}/manifest`;
}

// Оригинал с CDN бывает многомегабайтным (артист грузит мастер-обложку), а офлайн-копия
// нужна максимум под фуллскрин-плеер — берём ту же оптимизированную версию, что и UI.
export function coverPreviewUrl(coverUrl: string): string {
  if (coverUrl.startsWith('/') && !coverUrl.startsWith('//')) return coverUrl;
  return `/_next/image?url=${encodeURIComponent(coverUrl)}&w=640&q=75`;
}

// Не бросает наружу: сеть офлайн-загрузки нестабильна по определению (обрыв, отмена
// через signal), любой сбой должен оставить резюмируемую partial-запись, а не упасть ошибкой.
export async function downloadTrack(meta: DownloadMeta, options: DownloadOptions = {}): Promise<OfflineTrack> {
  const { onProgress, signal } = options;
  const cache = await caches.open(OFFLINE_CACHE);
  const existing = await getTrack(meta.id);

  let hlsUrl = existing?.hlsUrl || '';
  let segmentUrls = existing?.segmentUrls ?? [];
  let bytes = existing?.bytes ?? 0;
  let failed = false;

  // Манифест и .m3u8 перезапрашиваются на каждый вызов: пере-транскод трека (кнопка
  // «⟳ HLS» в админке) меняет состав сегментов по тем же S3-ключам, устаревший
  // segmentUrls из прошлой попытки докачал бы мусор. planDownload ниже уже отсекает
  // из свежего списка то, что реально лежит в кэше.
  if (!signal?.aborted) {
    try {
      const manifestUrl = manifestUrlFor(meta.id);
      const manifestRes = await fetch(manifestUrl, { signal });
      if (!manifestRes.ok) throw new Error('manifest fetch failed');
      const manifestBuf = await cachePut(cache, manifestUrl, manifestRes);
      const parsed = JSON.parse(new TextDecoder().decode(manifestBuf)) as { hlsUrl: string };

      const playlistRes = await fetch(parsed.hlsUrl, { signal });
      if (!playlistRes.ok) throw new Error('playlist fetch failed');
      const playlistBuf = await cachePut(cache, parsed.hlsUrl, playlistRes);

      // Байты манифеста/плейлиста считаем только на самой первой загрузке — иначе
      // повторные вызовы (докачка, ретрай) раз за разом накручивали бы bytes задвоением.
      if (!existing) bytes += manifestBuf.byteLength + playlistBuf.byteLength;

      hlsUrl = parsed.hlsUrl;
      segmentUrls = parseHlsSegments(new TextDecoder().decode(playlistBuf), hlsUrl);
    } catch {
      // сеть недоступна — доигрываем с тем, что знаем из прошлой попытки (partial-докачка)
    }
  }

  if (!hlsUrl) failed = true;

  const total = segmentUrls.length;
  let done = 0;

  if (!failed && total > 0) {
    const cachedKeys = (await cache.keys()).map((r) => r.url);
    const toDownload = planDownload(segmentUrls, cachedKeys);
    done = total - toDownload.length;
    onProgress?.(done, total);

    for (const batch of chunk(toDownload, CONCURRENCY)) {
      if (signal?.aborted) {
        failed = true;
        break;
      }
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          const res = await fetch(url, { signal });
          if (!res.ok) throw new Error(`segment fetch failed: ${url}`);
          bytes += await cachePutSized(cache, url, res);
          done += 1;
          onProgress?.(done, total);
        }),
      );
      if (results.some((r) => r.status === 'rejected')) {
        failed = true;
        break;
      }
    }
  }

  let coverBlob = existing?.coverBlob;
  if (!failed && meta.coverUrl && !coverBlob && !signal?.aborted) {
    try {
      const coverRes = await fetch(coverPreviewUrl(meta.coverUrl), { signal });
      if (coverRes.ok) {
        coverBlob = await coverRes.blob();
        bytes += coverBlob.size;
      }
    } catch {
      // обложка необязательна для офлайн-воспроизведения — не валим загрузку из-за неё
    }
  }

  const track: OfflineTrack = {
    id: meta.id,
    title: meta.title,
    artistName: meta.artistName,
    coverUrl: meta.coverUrl,
    artistSlug: meta.artistSlug,
    releaseId: meta.releaseId,
    isExplicit: meta.isExplicit,
    version: meta.version,
    durationSec: meta.durationSec,
    coverBlob,
    hlsUrl,
    segmentUrls,
    bytes,
    addedAt: existing?.addedAt ?? Date.now(),
    status: failed ? 'partial' : 'done',
  };
  await putTrack(track);
  return track;
}

/** Догружает обложки записям, скачанным до появления `coverBlob` — иначе у них офлайн
 *  остаётся битая картинка навсегда. Тихая best-effort операция: без сети просто ничего не делает. */
export async function backfillCovers(tracks: OfflineTrack[]): Promise<OfflineTrack[]> {
  const stale = tracks.filter((t) => !t.coverBlob && t.coverUrl);
  if (stale.length === 0) return [];

  const cache = await caches.open(OFFLINE_CACHE);
  const updated: OfflineTrack[] = [];
  for (const batch of chunk(stale, CONCURRENCY)) {
    const results = await Promise.allSettled(
      batch.map(async (track) => {
        const coverUrl = track.coverUrl!;
        const res = await fetch(coverPreviewUrl(coverUrl));
        if (!res.ok) throw new Error('cover fetch failed');
        const coverBlob = await res.blob();
        // Прежние версии клали оригинал в Cache Storage: он уже учтён в bytes, а отдать
        // его офлайн SW всё равно не может — меняем на превью и в кэше, и в счётчике.
        const oldSize = (await cache.match(coverUrl).then((r) => r?.blob()).catch(() => null))?.size ?? 0;
        await cache.delete(coverUrl);
        const next: OfflineTrack = { ...track, coverBlob, bytes: Math.max(0, track.bytes - oldSize) + coverBlob.size };
        await putTrack(next);
        return next;
      }),
    );
    for (const r of results) if (r.status === 'fulfilled') updated.push(r.value);
    // Одна сетевая ошибка обычно значит «сети нет» — дальше долбиться незачем.
    if (results.some((r) => r.status === 'rejected')) break;
  }
  return updated;
}

export async function cachedSegmentKeys(): Promise<string[]> {
  const cache = await caches.open(OFFLINE_CACHE);
  return (await cache.keys()).map((r) => r.url);
}

export async function removeDownload(trackId: string): Promise<void> {
  const track = await getTrack(trackId);
  const cache = await caches.open(OFFLINE_CACHE);
  releaseOfflineCoverUrl(trackId);
  if (track) {
    await cache.delete(manifestUrlFor(trackId));
    await cache.delete(track.hlsUrl);
    await Promise.all(track.segmentUrls.map((url) => cache.delete(url)));
    if (track.coverUrl) await cache.delete(track.coverUrl);
  }
  await deleteTrack(trackId);
}

export async function estimateUsage(): Promise<{ usage: number; quota: number }> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return { usage: 0, quota: 0 };
  }
}

// Best-effort: без persist() браузер вправе вычистить Cache Storage под давлением места.
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

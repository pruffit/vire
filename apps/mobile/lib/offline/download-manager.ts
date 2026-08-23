import { Directory, File, Paths } from 'expo-file-system';
import { trackManifestResponseSchema } from '@vire/api-contracts';
import { parseHlsSegments, rewritePlaylistForLocalSegments } from '@vire/media';
import { apiRequest } from '../api-client';

export interface DownloadedTrackMeta {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
  durationSec: number | null;
  bytes: number;
  addedAt: number;
  localPlaylistPath: string;
}

export type DownloadTrackInput = Pick<DownloadedTrackMeta, 'id' | 'title' | 'artistName' | 'coverUrl' | 'durationSec'>;

const OFFLINE_DIR_NAME = 'offline';
const INDEX_FILE_NAME = 'index.json';

/** Индекс скачанных треков — плоский JSON-массив, не БД: скачанных треков мало,
 *  читать/писать целиком каждый раз дешевле, чем тащить SQLite ради этого инкремента. */
export function parseIndex(text: string | null): DownloadedTrackMeta[] {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeIndex(entries: DownloadedTrackMeta[]): string {
  return JSON.stringify(entries);
}

export function sumBytes(entries: DownloadedTrackMeta[]): number {
  return entries.reduce((sum, e) => sum + e.bytes, 0);
}

function offlineDir(): Directory {
  return new Directory(Paths.document, OFFLINE_DIR_NAME);
}

function indexFile(): File {
  return new File(offlineDir(), INDEX_FILE_NAME);
}

function readIndex(): DownloadedTrackMeta[] {
  const file = indexFile();
  if (!file.exists) return [];
  try {
    return parseIndex(file.textSync());
  } catch {
    return [];
  }
}

function writeIndex(entries: DownloadedTrackMeta[]): void {
  const dir = offlineDir();
  if (!dir.exists) dir.create({ intermediates: true });
  indexFile().write(serializeIndex(entries));
}

export async function listDownloads(): Promise<DownloadedTrackMeta[]> {
  return readIndex();
}

export async function getDownloadedTrack(trackId: string): Promise<DownloadedTrackMeta | null> {
  return readIndex().find((entry) => entry.id === trackId) ?? null;
}

export async function estimateUsage(): Promise<number> {
  return sumBytes(readIndex());
}

/**
 * Скачивает трек целиком (манифест → плейлист → все сегменты → локальная перепись
 * плейлиста на относительные имена — см. @vire/media). Без резюмируемых докачек и
 * отмены — «скачать всё, показать %, готово/ошибка» осознанно первый, урезанный срез
 * (веб может резюмировать бесплатно за счёт Cache Storage, у RN-файловой системы это
 * отдельная работа, не оправданная для первого среза).
 */
export async function downloadTrack(
  meta: DownloadTrackInput,
  onProgress?: (done: number, total: number) => void,
): Promise<DownloadedTrackMeta> {
  const manifestResult = await apiRequest(`/api/v1/tracks/${meta.id}/manifest`, {
    schema: trackManifestResponseSchema,
  });
  if (!manifestResult.ok) {
    throw new Error(`не удалось получить манифест: ${JSON.stringify(manifestResult.error)}`);
  }
  const hlsUrl = manifestResult.data.hlsUrl;

  const playlistRes = await fetch(hlsUrl);
  if (!playlistRes.ok) throw new Error(`не удалось скачать плейлист: ${playlistRes.status}`);
  const playlistText = await playlistRes.text();
  const segmentUrls = parseHlsSegments(playlistText, hlsUrl);

  const trackDir = new Directory(offlineDir(), meta.id);
  if (trackDir.exists) trackDir.delete();
  trackDir.create({ intermediates: true });

  const localFilenames = segmentUrls.map((_, i) => `seg-${String(i).padStart(3, '0')}.ts`);
  const total = segmentUrls.length;
  let bytes = 0;
  onProgress?.(0, total);
  for (let i = 0; i < segmentUrls.length; i++) {
    const segmentFile = new File(trackDir, localFilenames[i]);
    await File.downloadFileAsync(segmentUrls[i], segmentFile);
    bytes += segmentFile.size ?? 0;
    onProgress?.(i + 1, total);
  }

  const rewritten = rewritePlaylistForLocalSegments(playlistText, localFilenames);
  const playlistFile = new File(trackDir, 'playlist.m3u8');
  playlistFile.write(rewritten);
  bytes += playlistFile.size ?? 0;

  const entry: DownloadedTrackMeta = {
    id: meta.id,
    title: meta.title,
    artistName: meta.artistName,
    coverUrl: meta.coverUrl,
    durationSec: meta.durationSec,
    bytes,
    addedAt: Date.now(),
    localPlaylistPath: playlistFile.uri,
  };

  writeIndex([...readIndex().filter((e) => e.id !== meta.id), entry]);
  return entry;
}

export async function removeDownload(trackId: string): Promise<void> {
  const trackDir = new Directory(offlineDir(), trackId);
  if (trackDir.exists) trackDir.delete();
  writeIndex(readIndex().filter((e) => e.id !== trackId));
}

import type { PlayerTrack } from '@/store/player';
import type { DownloadMeta } from './download';

export function toDownloadMeta(track: PlayerTrack): DownloadMeta {
  return {
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    coverUrl: track.coverUrl,
    artistSlug: track.artistSlug,
    releaseId: track.releaseId,
    isExplicit: track.isExplicit,
    version: track.version,
  };
}

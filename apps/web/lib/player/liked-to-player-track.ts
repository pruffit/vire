import type { LikedTrack } from '@vire/db';
import type { PlayerTrack } from '@/store/player';
import { toPlayerTrack } from './to-player-track';

/** LikedTrack хранит обложку в releaseCoverUrl — адаптер к общему мапперу. */
export function likedToPlayerTrack(t: LikedTrack): PlayerTrack {
  return toPlayerTrack({
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    artistSlug: t.artistSlug,
    releaseId: t.releaseId,
    coverUrl: t.releaseCoverUrl,
    accentColor: t.accentColor,
    isExplicit: t.isExplicit,
    version: t.version,
    feat: t.feat,
  });
}

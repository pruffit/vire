'use client';

import type { PlayerTrack } from '@/store/player';
import { useLikesStore } from '@/store/likes';
import { usePlay, useTrackPlayState } from '@/lib/player/use-play';
import { PlayerLikeButton } from '@/components/player-like-button';
import { TrackRow } from '@/components/track-row';
import { formatDuration } from '@/lib/format';

interface Props {
  track: PlayerTrack;
  queue: PlayerTrack[];
  queueIndex: number;
  durationSec: number | null;
  releaseCoverUrl: string | null;
  artistSlug: string;
  releaseId: string;
}

export function LikedTrackRow({ track, queue, queueIndex, durationSec, releaseCoverUrl }: Props) {
  const { playQueue, toggle } = usePlay();
  const { isActive: isThisTrack, isPlaying } = useTrackPlayState(track.id);

  const likeState = useLikesStore((s) => s.state[track.id]);

  if (likeState === false) return null;

  function handlePlay() {
    if (isThisTrack) toggle(track.id);
    else playQueue(queue, { startIndex: queueIndex, context: { source: 'liked' } });
  }

  return (
    <TrackRow
      track={{
        id: track.id, title: track.title, artistName: track.artistName, isExplicit: track.isExplicit,
        coverUrl: releaseCoverUrl, version: track.version, feat: track.feat,
      }}
      isActive={isThisTrack}
      isPlaying={isPlaying}
      onPlay={handlePlay}
      clickableRow
      trailing={
        <>
          {durationSec != null && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0 hidden sm:block">
              {formatDuration(durationSec)}
            </span>
          )}
          <span className="shrink-0 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <PlayerLikeButton trackId={track.id} size="sm" />
          </span>
        </>
      }
    />
  );
}

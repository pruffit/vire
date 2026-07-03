'use client';

import Image from 'next/image';
import type { PlayerTrack } from '@/store/player';
import { useLikesStore } from '@/store/likes';
import { usePlay } from '@/lib/player/use-play';
import { PlayerLikeButton } from '@/components/player-like-button';
import { PlayIcon, PauseIcon } from '@/components/icons';
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
  const { playQueue, toggle, isCurrent, isPlaying } = usePlay();
  const isThisTrack = isCurrent(track.id);

  const likeState = useLikesStore((s) => s.state[track.id]);

  // Auto-hide when explicitly unliked
  if (likeState === false) return null;

  function handlePlay() {
    if (isThisTrack) toggle(track.id);
    else playQueue(queue, { startIndex: queueIndex, context: { source: 'liked' } });
  }

  return (
    <div className="group flex items-center gap-3 py-2.5 -mx-3 px-3 rounded-sm hover:bg-accent/5 transition-colors">
      <div
        className="w-9 h-9 shrink-0 rounded-sm overflow-hidden bg-muted relative cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`Воспроизвести ${track.title}`}
        onClick={handlePlay}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePlay(); } }}
      >
        {releaseCoverUrl ? (
          <Image src={releaseCoverUrl} alt={track.title} fill quality={60} sizes="36px" className="object-cover" />
        ) : (
          <div className="w-full h-full bg-white/5" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {isThisTrack && isPlaying ? <PauseIcon size={12} className="text-white" /> : <PlayIcon size={12} className="text-white" />}
        </span>
      </div>

      <div
        className="flex-1 min-w-0 cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`Воспроизвести ${track.title}`}
        onClick={handlePlay}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePlay(); } }}
      >
        <p
          className="text-sm font-medium truncate"
          style={isThisTrack ? { color: 'var(--primary)' } : undefined}
        >
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
      </div>

      {durationSec != null && (
        <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0 hidden sm:block">
          {formatDuration(durationSec)}
        </span>
      )}

      <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <PlayerLikeButton trackId={track.id} size="sm" />
      </span>
    </div>
  );
}


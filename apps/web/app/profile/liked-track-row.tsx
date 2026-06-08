'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { useLikesStore } from '@/store/likes';
import { controls, initAudioEngine } from '@/components/player/audio-engine';
import { PlayerLikeButton } from '@/components/player-like-button';
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
  useEffect(() => { initAudioEngine(); }, []);

  const currentTrackId = usePlayerStore((s) => s.track?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isThisTrack = currentTrackId === track.id;

  const likeState = useLikesStore((s) => s.state[track.id]);

  // Auto-hide when explicitly unliked
  if (likeState === false) return null;

  function handlePlay() {
    if (isThisTrack) controls.togglePlay();
    else controls.play(track, queue, queueIndex);
  }

  return (
    <div className="group flex items-center gap-3 py-2.5 -mx-3 px-3 rounded-sm hover:bg-accent/5 transition-colors">
      <div className="w-9 h-9 shrink-0 rounded-sm overflow-hidden bg-muted relative cursor-pointer" onClick={handlePlay}>
        {releaseCoverUrl ? (
          <Image src={releaseCoverUrl} alt={track.title} fill sizes="36px" className="object-cover" />
        ) : (
          <div className="w-full h-full bg-white/5" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {isThisTrack && isPlaying ? <PauseIcon /> : <PlayIcon />}
        </span>
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={handlePlay}>
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

function PlayIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="white" aria-hidden="true"><polygon points="5,3 19,12 5,21" /></svg>;
}
function PauseIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="white" aria-hidden="true"><rect x="5" y="3" width="4" height="18" rx="1" /><rect x="15" y="3" width="4" height="18" rx="1" /></svg>;
}

'use client';

import { useEffect } from 'react';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls, initAudioEngine } from '@/components/player/audio-engine';

interface Props {
  track: PlayerTrack;
  queue: PlayerTrack[];
  queueIndex: number;
  durationSec: number | null;
  releaseCoverUrl: string | null;
  artistSlug: string;
  releaseId: string;
}

export function LikedTrackRow({ track, queue, queueIndex, durationSec, releaseCoverUrl, artistSlug, releaseId }: Props) {
  useEffect(() => {
    initAudioEngine();
  }, []);

  const currentTrackId = usePlayerStore((s) => s.track?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isThisTrack = currentTrackId === track.id;

  function handlePlay() {
    if (isThisTrack) {
      controls.togglePlay();
    } else {
      controls.play(track, queue, queueIndex);
    }
  }

  return (
    <div className="group flex items-center gap-3 py-2.5 -mx-3 px-3 rounded-sm hover:bg-accent/5 transition-colors">
      {/* Cover */}
      <div className="w-9 h-9 shrink-0 rounded-sm overflow-hidden bg-muted relative">
        {releaseCoverUrl ? (
          <img src={releaseCoverUrl} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/5" />
        )}
        <button
          onClick={handlePlay}
          aria-label={isThisTrack && isPlaying ? 'Пауза' : 'Играть'}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {isThisTrack && isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <a
          href={`/artists/${artistSlug}/releases/${releaseId}/tracks/${track.id}`}
          className="text-sm font-medium truncate block hover:underline"
        >
          {track.title}
        </a>
        <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
      </div>

      {/* Duration */}
      {durationSec != null && (
        <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
          {fmt(durationSec)}
        </span>
      )}
    </div>
  );
}

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
      <rect x="5" y="3" width="4" height="18" rx="1" />
      <rect x="15" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

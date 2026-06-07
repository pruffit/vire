'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls, initAudioEngine } from '@/components/player/audio-engine';
import { formatDuration } from '@/lib/format';

interface Props {
  track: PlayerTrack;
  queue: PlayerTrack[];
  queueIndex: number;
  durationSec: number | null;
  releaseCoverUrl: string | null;
  artistSlug: string;
  releaseId: string;
  trackId: string;
}

export function PurchasedTrackRow({
  track,
  queue,
  queueIndex,
  durationSec,
  releaseCoverUrl,
  artistSlug,
  releaseId,
  trackId,
}: Props) {
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
          <Image src={releaseCoverUrl} alt={track.title} fill sizes="36px" className="object-cover" />
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
        <Link
          href={`/artists/${artistSlug}/releases/${releaseId}/tracks/${trackId}`}
          className="text-sm font-medium truncate block hover:underline"
        >
          {track.title}
        </Link>
        <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
      </div>

      {/* Duration */}
      {durationSec != null && (
        <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
          {formatDuration(durationSec)}
        </span>
      )}

      {/* Download */}
      <a
        href={`/api/v1/tracks/${trackId}/download`}
        download
        title="Скачать FLAC"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Скачать FLAC"
      >
        <DownloadIcon />
      </a>
    </div>
  );
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

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

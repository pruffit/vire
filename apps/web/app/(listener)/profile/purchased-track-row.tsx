'use client';

import type { PlayerTrack } from '@/store/player';
import { usePlay } from '@/lib/player/use-play';
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
  const { playQueue, toggle, isCurrent, isPlaying } = usePlay();
  const isThisTrack = isCurrent(track.id);

  function handlePlay() {
    if (isThisTrack) toggle(track.id);
    else playQueue(queue, { startIndex: queueIndex, context: { source: 'purchased' } });
  }

  return (
    <TrackRow
      track={{ id: track.id, title: track.title, artistName: track.artistName, isExplicit: track.isExplicit, coverUrl: releaseCoverUrl }}
      isActive={isThisTrack}
      isPlaying={isPlaying}
      onPlay={handlePlay}
      titleHref={`/artists/${artistSlug}/releases/${releaseId}/tracks/${trackId}`}
      trailing={
        <>
          {durationSec != null && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
              {formatDuration(durationSec)}
            </span>
          )}
          <a
            href={`/api/v1/tracks/${trackId}/download`}
            download
            title="Скачать FLAC"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Скачать FLAC"
          >
            <DownloadIcon />
          </a>
        </>
      }
    />
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

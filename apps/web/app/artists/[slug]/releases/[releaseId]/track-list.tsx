'use client';

import Link from 'next/link';
import { controls } from '@/components/player/audio-engine';
import { type PlayerTrack } from '@/store/player';
import type { Track } from '@vire/core';

interface Props {
  tracks: Track[];
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
}

export function TrackList({ tracks, artistName, artistSlug, releaseId, coverUrl }: Props) {
  if (tracks.length === 0) return null;

  const queue: PlayerTrack[] = tracks
    .filter((t) => t.status === 'READY')
    .map((t) => ({ id: t.id, title: t.title, artistName, coverUrl }));

  function handlePlay(track: Track) {
    if (track.status !== 'READY') return;
    const idx = queue.findIndex((q) => q.id === track.id);
    controls.play(queue[idx] ?? { id: track.id, title: track.title, artistName, coverUrl }, queue, idx);
  }

  return (
    <section className="space-y-0.5">
      {tracks.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          artistSlug={artistSlug}
          releaseId={releaseId}
          onPlay={() => handlePlay(track)}
        />
      ))}
    </section>
  );
}

function TrackRow({
  track,
  artistSlug,
  releaseId,
  onPlay,
}: {
  track: Track;
  artistSlug: string;
  releaseId: string;
  onPlay: () => void;
}) {
  const ready = track.status === 'READY';
  const processing = track.status === 'PROCESSING';

  return (
    <div
      role={ready ? 'button' : undefined}
      tabIndex={ready ? 0 : undefined}
      onClick={ready ? onPlay : undefined}
      onKeyDown={ready ? (e) => e.key === 'Enter' && onPlay() : undefined}
      className={`group flex items-center gap-4 px-3 py-2.5 rounded-sm transition-colors select-none ${
        ready
          ? 'hover:bg-white/5 cursor-pointer'
          : 'opacity-40 cursor-default'
      }`}
    >
      <span className="w-6 text-right text-xs font-mono opacity-30 shrink-0">
        {track.trackNumber}
      </span>

      <div className="flex-1 min-w-0">
        <span className="text-sm truncate block">{track.title}</span>
        {track.credits.length > 0 && (
          <span className="text-[10px] font-mono opacity-30 truncate block">
            {track.credits.map((c) => c.name).join(', ')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {track.isExclusive && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm"
            style={{
              color: 'var(--artist-accent)',
              background: 'color-mix(in oklch, var(--artist-accent) 15%, transparent)',
            }}
          >
            excl
          </span>
        )}
        {track.isWip && (
          <span className="text-[10px] font-mono opacity-40">wip</span>
        )}
        {processing && (
          <span className="text-[10px] font-mono opacity-30">обработка…</span>
        )}
        {track.durationSec != null && ready && (
          <span className="text-xs font-mono opacity-30 w-10 text-right">
            {fmt(track.durationSec)}
          </span>
        )}
        <Link
          href={`/artists/${artistSlug}/releases/${releaseId}/tracks/${track.id}`}
          onClick={(e) => e.stopPropagation()}
          aria-label="Страница трека"
          className="opacity-0 group-hover:opacity-30 hover:!opacity-70 transition-opacity text-[10px] font-mono"
        >
          →
        </Link>
      </div>
    </div>
  );
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

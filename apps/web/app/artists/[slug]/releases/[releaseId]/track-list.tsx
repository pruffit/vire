'use client';

import { controls } from '@/components/player/audio-engine';
import { type PlayerTrack } from '@/store/player';
import type { Track } from '@vire/core';

interface Props {
  tracks: Track[];
  artistName: string;
  coverUrl: string | null;
}

export function TrackList({ tracks, artistName, coverUrl }: Props) {
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
        <TrackRow key={track.id} track={track} onPlay={() => handlePlay(track)} />
      ))}
    </section>
  );
}

function TrackRow({ track, onPlay }: { track: Track; onPlay: () => void }) {
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

      <span className="flex-1 text-sm truncate">{track.title}</span>

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
      </div>
    </div>
  );
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

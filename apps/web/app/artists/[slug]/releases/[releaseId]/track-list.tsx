'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { spring, Stagger, StaggerItem } from '@vire/ui/motion';
import { controls } from '@/components/player/audio-engine';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import type { TrackStatus, TrackCredit } from '@vire/core';
import { formatDuration } from '@/lib/format';

export interface ClientTrack {
  id: string;
  title: string;
  trackNumber: number;
  durationSec: number | null;
  status: TrackStatus;
  isExclusive: boolean;
  isWip: boolean;
  credits: TrackCredit[];
}

interface Props {
  tracks: ClientTrack[];
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
}

export function TrackList({ tracks, artistName, artistSlug, releaseId, coverUrl }: Props) {
  if (tracks.length === 0) return null;

  const queue: PlayerTrack[] = tracks
    .filter((t) => t.status === 'READY')
    .map((t) => ({ id: t.id, title: t.title, artistName, coverUrl, artistSlug, releaseId }));

  function handlePlay(track: ClientTrack) {
    if (track.status !== 'READY') return;
    const idx = queue.findIndex((q) => q.id === track.id);
    controls.play(
      queue[idx] ?? { id: track.id, title: track.title, artistName, coverUrl, artistSlug, releaseId },
      queue,
      idx,
    );
  }

  return (
    <Stagger step={0.035} className="space-y-0.5">
      {tracks.map((track) => (
        <StaggerItem key={track.id}>
          <TrackRow
            track={track}
            artistSlug={artistSlug}
            releaseId={releaseId}
            onPlay={() => handlePlay(track)}
          />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function TrackRow({
  track,
  artistSlug,
  releaseId,
  onPlay,
}: {
  track: ClientTrack;
  artistSlug: string;
  releaseId: string;
  onPlay: () => void;
}) {
  const ready = track.status === 'READY';
  const processing = track.status === 'PROCESSING';

  const isActive = usePlayerStore((s) => s.track?.id) === track.id;
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  return (
    <motion.div
      role={ready ? 'button' : undefined}
      tabIndex={ready ? 0 : undefined}
      onClick={ready ? onPlay : undefined}
      onKeyDown={ready ? (e) => e.key === 'Enter' && onPlay() : undefined}
      whileTap={ready ? { scale: 0.99 } : undefined}
      transition={spring.snappy}
      className={`group flex items-center gap-4 px-3 py-2.5 rounded-sm transition-colors select-none ${
        ready
          ? 'hover:bg-white/5 cursor-pointer'
          : 'opacity-40 cursor-default'
      } ${isActive ? 'bg-white/5' : ''}`}
    >
      <span className={`w-6 flex justify-end text-xs font-mono shrink-0 ${isActive ? '' : 'opacity-30'}`}>
        {isActive ? (
          <PlayingBars animate={isPlaying} />
        ) : (
          track.trackNumber
        )}
      </span>

      <div className="flex-1 min-w-0">
        <span
          className="text-sm truncate block"
          style={isActive ? { color: 'var(--artist-accent)' } : undefined}
        >
          {track.title}
        </span>
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
            {formatDuration(track.durationSec)}
          </span>
        )}
        <Link
          href={`/artists/${artistSlug}/releases/${releaseId}/tracks/${track.id}`}
          onClick={(e) => e.stopPropagation()}
          aria-label="Страница трека"
          className="opacity-0 group-hover:opacity-30 hover:!opacity-70 focus-visible:opacity-70 transition-opacity text-[10px] font-mono"
        >
          →
        </Link>
      </div>
    </motion.div>
  );
}

/** Маленький эквалайзер: три полоски, анимируются пока трек играет. */
function PlayingBars({ animate }: { animate: boolean }) {
  return (
    <span className="flex items-end gap-[2px] h-3" style={{ color: 'var(--artist-accent)' }} aria-label="Сейчас играет">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-current rounded-full"
          style={{
            height: animate ? undefined : '40%',
            animation: animate ? `vire-eq 0.9s ease-in-out ${i * 0.15}s infinite` : undefined,
          }}
        />
      ))}
      <style>{`@keyframes vire-eq { 0%,100% { height: 30%; } 50% { height: 100%; } }`}</style>
    </span>
  );
}

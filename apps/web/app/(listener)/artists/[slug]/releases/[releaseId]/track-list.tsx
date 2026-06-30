'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { spring, Stagger, StaggerItem } from '@vire/ui/motion';
import { controls } from '@/components/player/audio-engine';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { PlayerLikeButton } from '@/components/player-like-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import type { TrackStatus, TrackCredit } from '@vire/core';
import { formatDuration } from '@/lib/format';
import { displayTrackTitle } from '@/lib/track-display';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { PlayingBars } from '@/components/playing-bars';

export interface ClientTrack {
  id: string;
  title: string;
  version: string | null;
  trackNumber: number;
  durationSec: number | null;
  status: TrackStatus;
  isExclusive: boolean;
  isWip: boolean;
  isExplicit: boolean;
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
    .map((t) => ({ id: t.id, title: t.title, artistName, coverUrl, artistSlug, releaseId, isExplicit: t.isExplicit }));

  function handlePlay(track: ClientTrack) {
    if (track.status !== 'READY') return;
    const idx = queue.findIndex((q) => q.id === track.id);
    controls.play(
      queue[idx] ?? { id: track.id, title: track.title, artistName, coverUrl, artistSlug, releaseId, isExplicit: track.isExplicit },
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
            href={`/artists/${artistSlug}/releases/${releaseId}/tracks/${track.id}`}
            onPlay={() => handlePlay(track)}
          />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function TrackRow({
  track,
  href,
  onPlay,
}: {
  track: ClientTrack;
  href: string;
  onPlay: () => void;
}) {
  const ready = track.status === 'READY';
  const processing = track.status === 'PROCESSING';

  const isActive = usePlayerStore((s) => s.track?.id) === track.id;
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-sm transition-colors ${
        ready || processing
          ? 'hover:bg-[color-mix(in_oklch,var(--artist-text)_7%,transparent)]'
          : 'opacity-40'
      } ${isActive ? 'bg-[color-mix(in_oklch,var(--artist-text)_7%,transparent)]' : ''}`}
    >
      {/* Лидирующая кнопка — играть/пауза. Номер трека, по ховеру (десктоп) — иконка play. */}
      <motion.button
        type="button"
        disabled={!ready}
        onClick={isActive ? () => controls.togglePlay() : onPlay}
        aria-label={isActive && isPlaying ? 'Пауза' : `Играть «${track.title}»`}
        whileTap={ready ? { scale: 0.9 } : undefined}
        transition={spring.snappy}
        className={`w-7 h-7 flex items-center justify-center text-xs font-mono shrink-0 rounded-sm ${
          ready ? 'cursor-pointer focus-visible:ring-1 focus-visible:ring-[var(--artist-accent)] outline-none' : 'cursor-default'
        } ${isActive ? '' : 'text-[color-mix(in_oklch,var(--artist-text)_30%,transparent)]'}`}
        style={isActive ? { color: 'var(--artist-accent)' } : undefined}
      >
        {isActive ? (
          isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} className="translate-x-px" />
        ) : ready ? (
          <>
            <span className="tabular-nums group-hover:hidden">{track.trackNumber}</span>
            <PlayIcon size={13} className="hidden group-hover:block translate-x-px text-[var(--artist-text)]" />
          </>
        ) : (
          <span className="tabular-nums">{track.trackNumber}</span>
        )}
      </motion.button>

      {/* Клик по названию/строке — открыть страницу трека (основное действие). */}
      <Link href={href} className="flex-1 min-w-0 group/link">
        <span
          className="text-sm truncate flex items-center gap-1.5 transition-colors group-hover/link:text-[var(--artist-accent)]"
          style={isActive ? { color: 'var(--artist-accent)' } : undefined}
        >
          <span className="truncate">
            {displayTrackTitle(track.title, { version: track.version, credits: track.credits })}
          </span>
          {track.isExplicit && <ExplicitBadge />}
        </span>
        {(() => {
          // feat-имена уже в названии — в строке кредитов показываем остальных
          const rest = track.credits.filter((c) => c.role !== 'FEATURED').map((c) => c.name);
          return rest.length > 0 ? (
            <span className="text-[10px] font-mono text-[color-mix(in_oklch,var(--artist-text)_30%,transparent)] truncate block">
              {rest.join(', ')}
            </span>
          ) : null;
        })()}
      </Link>

      <div className="flex items-center gap-2 shrink-0">
        {isActive && <PlayingBars animate={isPlaying} />}
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
          <span className="text-[10px] font-mono text-[color-mix(in_oklch,var(--artist-text)_40%,transparent)]">wip</span>
        )}
        {processing && (
          <span className="text-[10px] font-mono text-[color-mix(in_oklch,var(--artist-text)_30%,transparent)]">обработка…</span>
        )}
        {track.durationSec != null && ready && (
          <span className="text-xs font-mono text-[color-mix(in_oklch,var(--artist-text)_30%,transparent)] w-10 text-right">
            {formatDuration(track.durationSec)}
          </span>
        )}
        {ready && (
          <span className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <PlayerLikeButton trackId={track.id} size="sm" />
          </span>
        )}
      </div>
    </div>
  );
}


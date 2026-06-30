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
import { Icon } from '@/components/icon';
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
    <motion.div
      role={ready ? 'button' : undefined}
      tabIndex={ready ? 0 : undefined}
      onClick={ready ? (isActive ? () => controls.togglePlay() : onPlay) : undefined}
      onKeyDown={ready ? (e) => e.key === 'Enter' && (isActive ? controls.togglePlay() : onPlay()) : undefined}
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
          className="text-sm truncate flex items-center gap-1.5"
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
            <span className="text-[10px] font-mono opacity-30 truncate block">
              {rest.join(', ')}
            </span>
          ) : null;
        })()}
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
        {ready && (
          <span
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <PlayerLikeButton trackId={track.id} size="sm" />
          </span>
        )}
        {/* Переход на страницу трека: клик по строке играет, стрелка — открывает.
            На тач-устройствах ховера нет, поэтому стрелка видна всегда. */}
        <Link
          href={href}
          aria-label={`Страница трека «${track.title}»`}
          onClick={(e) => e.stopPropagation()}
          className="p-1 -m-1 opacity-40 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <ArrowIcon />
        </Link>
      </div>
    </motion.div>
  );
}

function ArrowIcon() {
  return <Icon name="chevron-right" size={14} />;
}


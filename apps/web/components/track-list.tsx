'use client';

import Image from 'next/image';
import { motion } from 'motion/react';
import { spring, Stagger, StaggerItem } from '@vire/ui/motion';
import type { PlayerTrack, PlayContext } from '@/store/player';
import { toPlayerTracks } from '@/lib/player/to-player-track';
import { usePlay } from '@/lib/player/use-play';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { ExplicitBadge } from '@/components/explicit-badge';
import { formatCount } from '@/lib/format';
import { PlayerLikeButton } from './player-like-button';

export interface PlayableTrackItem {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor?: string | null;
  isExplicit?: boolean;
  plays?: number;
}

export function PlayableTrackList({
  tracks,
  variant = 'plain',
  columns = 2,
  context,
}: {
  tracks: PlayableTrackItem[];
  variant?: 'plain' | 'ranked';
  columns?: 1 | 2;
  context: PlayContext;
}) {
  const queue: PlayerTrack[] = toPlayerTracks(tracks);

  const grid = columns === 2 ? 'grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8' : 'grid grid-cols-1';

  return (
    <Stagger step={0.03} className={grid}>
      {tracks.map((t, i) => (
        <StaggerItem key={t.id}>
          <Row track={t} queue={queue} index={i} rank={variant === 'ranked' ? i + 1 : null} context={context} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function Row({
  track, queue, index, rank, context,
}: {
  track: PlayableTrackItem;
  queue: PlayerTrack[];
  index: number;
  rank: number | null;
  context: PlayContext;
}) {
  const { playQueue, toggle, isCurrent, isPlaying } = usePlay();
  const isActive = isCurrent(track.id);

  function handleClick() {
    if (isActive) toggle(track.id);
    else playQueue(queue, { startIndex: index, context });
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      whileTap={{ scale: 0.99 }}
      transition={spring.snappy}
      className="group flex items-center gap-3 py-3 border-b border-border/60 hover:bg-accent/5 -mx-2 px-2 rounded-sm transition-colors cursor-pointer select-none"
    >
      {rank != null && (
        <span className="w-6 shrink-0 text-center font-mono text-sm tabular-nums text-muted-foreground group-hover:text-foreground transition-colors">
          {rank}
        </span>
      )}
      <div className="relative w-9 h-9 shrink-0 rounded-sm overflow-hidden bg-muted">
        {track.coverUrl ? (
          <Image src={track.coverUrl} alt={track.title} fill quality={60} sizes="36px" className="object-cover" />
        ) : (
          <div className="w-full h-full bg-white/5" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {isActive && isPlaying ? <PauseIcon size={12} className="text-white" /> : <PlayIcon size={12} className="text-white" />}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate flex items-center gap-1.5" style={isActive ? { color: 'var(--primary)' } : undefined}>
          <span className="truncate">{track.title}</span>
          {track.isExplicit && <ExplicitBadge />}
        </p>
        <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
      </div>
      {track.plays != null && track.plays > 0 && (
        <span className="shrink-0 text-xs font-mono tabular-nums text-muted-foreground hidden sm:block group-hover:opacity-0 transition-opacity">
          {formatCount(track.plays)}
        </span>
      )}
      <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <PlayerLikeButton trackId={track.id} size="sm" />
      </span>
    </motion.div>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring, Stagger, StaggerItem } from '@vire/ui/motion';
import { controls } from '@/lib/player/audio-engine';
import { type PlayerTrack } from '@/store/player';
import { useTrackPlayState } from '@/lib/player/use-play';
import { PlayerLikeButton } from '@/components/player-like-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { PlayingBars } from '@/components/playing-bars';
import { TrackTitleText } from '@/components/track-title';
import { formatDuration } from '@/lib/format';

export type ArtistPopularTrack = PlayerTrack & { durationSec: number | null };

export function ArtistPopularTracks({
  tracks,
  initialCount = 5,
}: {
  tracks: ArtistPopularTrack[];
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (tracks.length === 0) return null;

  const shown = expanded ? tracks : tracks.slice(0, initialCount);
  const queue: PlayerTrack[] = shown.map(({ durationSec: _d, ...t }) => t);
  const artistSlug = tracks[0]?.artistSlug;

  function handlePlay(i: number) {
    const track = queue[i];
    if (track) controls.playQueue(queue, { startIndex: i, context: { source: 'artist', sourceId: artistSlug } });
  }

  return (
    <Stagger step={0.03} className="flex flex-col gap-0.5">
      {shown.map((track, i) => (
        <StaggerItem key={track.id}>
          <Row track={track} rank={i + 1} onPlay={() => handlePlay(i)} />
        </StaggerItem>
      ))}
      {tracks.length > initialCount && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 self-start min-h-11 px-3 text-xs font-mono uppercase tracking-[0.15em] transition-opacity hover:opacity-80"
          style={{ color: 'var(--artist-accent)' }}
        >
          {expanded ? 'Свернуть' : `Все треки (${tracks.length})`}
        </button>
      )}
    </Stagger>
  );
}

function Row({
  track,
  rank,
  onPlay,
}: {
  track: ArtistPopularTrack;
  rank: number;
  onPlay: () => void;
}) {
  const { isActive, isPlaying } = useTrackPlayState(track.id);

  function activate() {
    if (isActive) controls.togglePlay();
    else onPlay();
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      whileTap={{ scale: 0.99 }}
      transition={spring.snappy}
      className={`group flex min-h-11 items-center gap-4 px-3 py-2.5 rounded-sm cursor-pointer select-none transition-colors hover:bg-[color-mix(in_oklch,var(--artist-text)_7%,transparent)] ${
        isActive ? 'bg-[color-mix(in_oklch,var(--artist-text)_7%,transparent)]' : ''
      }`}
    >
      <span
        className="w-6 flex justify-end text-xs font-mono tabular-nums shrink-0"
        style={isActive ? undefined : { color: 'color-mix(in oklch, var(--artist-text) 40%, transparent)' }}
      >
        {isActive ? <PlayingBars animate={isPlaying} /> : rank}
      </span>

      <div className="flex-1 min-w-0">
        <span
          className="text-sm truncate flex items-center gap-1.5"
          style={isActive ? { color: 'var(--artist-accent)' } : undefined}
        >
          <span className="truncate">
            <TrackTitleText title={track.title} version={track.version} feat={track.feat} />
          </span>
          {track.isExplicit && <ExplicitBadge />}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {track.durationSec != null && (
          <span className="text-xs font-mono tabular-nums w-10 text-right" style={{ color: 'color-mix(in oklch, var(--artist-text) 40%, transparent)' }}>
            {formatDuration(track.durationSec)}
          </span>
        )}
        <span
          className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <PlayerLikeButton trackId={track.id} size="sm" />
        </span>
      </div>
    </motion.div>
  );
}

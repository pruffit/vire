'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { spring, Stagger, StaggerItem } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { controls, initAudioEngine } from '@/components/player/audio-engine';
import type { SearchTrack } from '@vire/db';
import type { PlayerTrack } from '@/store/player';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { PlayerLikeButton } from './player-like-button';

export function SearchTracksSection({ tracks }: { tracks: SearchTrack[] }) {
  useEffect(() => { initAudioEngine(); }, []);

  const queue: PlayerTrack[] = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    coverUrl: t.coverUrl,
    artistSlug: t.artistSlug,
    releaseId: t.releaseId,
  }));

  return (
    <Stagger step={0.035} className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8">
      {tracks.map((t, i) => (
        <StaggerItem key={t.id}>
          <SearchTrackRow track={t} queue={queue} queueIndex={i} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function SearchTrackRow({
  track,
  queue,
  queueIndex,
}: {
  track: SearchTrack;
  queue: PlayerTrack[];
  queueIndex: number;
}) {
  const isActive = usePlayerStore((s) => s.track?.id === track.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  function handleClick() {
    if (isActive) controls.togglePlay();
    else controls.play(queue[queueIndex], queue, queueIndex);
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
        <p
          className="text-sm font-medium truncate"
          style={isActive ? { color: 'var(--primary)' } : undefined}
        >
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
      </div>
      <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <PlayerLikeButton trackId={track.id} size="sm" />
      </span>
    </motion.div>
  );
}


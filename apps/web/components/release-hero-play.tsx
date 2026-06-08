'use client';

import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { controls } from '@/components/player/audio-engine';
import type { PlayerTrack } from '@/store/player';

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="translate-x-[1px]">
      <polygon points="6,4 20,12 6,20" />
    </svg>
  );
}

export function ReleaseHeroPlay({ queue }: { queue: PlayerTrack[] }) {
  if (queue.length === 0) return null;

  function play() {
    if (queue[0]) controls.play(queue[0], queue, 0);
  }

  return (
    <motion.button
      type="button"
      onClick={play}
      whileTap={{ scale: 0.96 }}
      transition={spring.snappy}
      className="inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
      style={{
        background: 'color-mix(in oklch, var(--artist-text) 90%, transparent)',
        color: 'var(--artist-bg)',
      }}
    >
      <PlayIcon />
      Слушать
    </motion.button>
  );
}

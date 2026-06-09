'use client';

import { motion } from 'motion/react';
import { MOOD_LABELS, type Mood } from '@/lib/moods';
import { cn } from '@/lib/utils';

interface Props {
  moods: Mood[];
  /** Стиль подачи: artist-page использует artist-tokens, platform — нейтральный */
  variant?: 'artist' | 'platform';
  className?: string;
}

export function MoodBadges({ moods, variant = 'platform', className }: Props) {
  if (moods.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {moods.map((mood, i) => (
        <motion.span
          key={mood}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'px-2.5 py-0.5 rounded-full text-[11px] font-mono leading-5 tracking-wide border',
            variant === 'artist'
              ? 'border-[color-mix(in_oklch,var(--artist-accent)_30%,transparent)] text-[var(--artist-text)] opacity-60'
              : 'border-border text-muted-foreground',
          )}
        >
          {MOOD_LABELS[mood]}
        </motion.span>
      ))}
    </div>
  );
}

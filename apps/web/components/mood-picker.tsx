'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ALL_MOODS, MOOD_LABELS, type Mood } from '@/lib/moods';
import { touchPill } from '@/components/popover';
import { cn } from '@/lib/utils';

interface Props {
  trackId: string;
  initial: Mood[];
  onSave?: (moods: Mood[]) => void;
}

export function MoodPicker({ trackId, initial, onSave }: Props) {
  const [selected, setSelected] = useState<Set<Mood>>(new Set(initial));
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(mood: Mood) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mood)) {
        next.delete(mood);
      } else if (next.size < 5) {
        next.add(mood);
      }
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    const moods = Array.from(selected);
    startTransition(async () => {
      await fetch(`/api/v1/tracks/${trackId}/moods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moods }),
      });
      setSaved(true);
      onSave?.(moods);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Настроение <span className="opacity-50">({selected.size}/5)</span>
        </span>
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs font-mono text-muted-foreground"
            >
              Сохранено
            </motion.span>
          ) : (
            <motion.button
              key="save"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleSave}
              disabled={isPending}
              className="text-xs font-mono text-foreground underline-offset-2 hover:underline disabled:opacity-40"
            >
              {isPending ? 'Сохраняю…' : 'Сохранить'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_MOODS.map((mood) => {
          const active = selected.has(mood);
          return (
            <button
              key={mood}
              onClick={() => toggle(mood)}
              aria-pressed={active}
              disabled={!active && selected.size >= 5}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-mono border transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                touchPill,
                active
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground',
              )}
            >
              {MOOD_LABELS[mood]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ALL_GENRES, GENRE_LABELS, type Genre } from '@/lib/genres';
import { cn } from '@/lib/utils';

const MAX = 3;

interface Props {
  trackId: string;
  initial: Genre[];
}

export function GenrePicker({ trackId, initial }: Props) {
  const [selected, setSelected] = useState<Set<Genre>>(new Set(initial));
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(genre: Genre) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) {
        next.delete(genre);
      } else if (next.size < MAX) {
        next.add(genre);
      }
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    const genres = Array.from(selected);
    startTransition(async () => {
      await fetch(`/api/v1/dashboard/tracks/${trackId}/genres`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genres }),
      });
      setSaved(true);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-white/40 uppercase tracking-widest">
          Жанры <span className="opacity-50">({selected.size}/{MAX})</span>
        </span>
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs font-mono text-white/40"
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
              className="text-xs font-mono text-white underline-offset-2 hover:underline disabled:opacity-40"
            >
              {isPending ? 'Сохраняю…' : 'Сохранить'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_GENRES.map((genre) => {
          const active = selected.has(genre);
          return (
            <button
              key={genre}
              onClick={() => toggle(genre)}
              aria-pressed={active}
              disabled={!active && selected.size >= MAX}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-mono border transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                active
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-white/40 border-white/10 hover:border-white/40 hover:text-white/70',
              )}
            >
              {GENRE_LABELS[genre]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

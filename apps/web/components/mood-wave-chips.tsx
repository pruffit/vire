'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { MOOD_LABELS, type Mood } from '@/lib/moods';
import { controls } from '@/components/player/audio-engine';
import { PlayIcon } from '@/components/icons';
import { toast } from '@/components/toast';

export interface MoodChip {
  mood: Mood;
  count: number;
}

/**
 * Чипы тегов настроения на главной: клик запускает волну с трека с этим тегом
 * (seed-режим волны с mood-фильтром), дальше похожесть ведёт поток сама.
 */
// Сколько тегов показывать свёрнутыми — остальные прячем за «ещё», чтобы блок
// не разрастался в три-четыре ряда при большом числе задействованных настроений.
const COLLAPSED_LIMIT = 10;

export function MoodWaveChips({ moods }: { moods: MoodChip[] }) {
  const [loading, setLoading] = useState<Mood | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function start(mood: Mood) {
    if (loading) return;
    setLoading(mood);
    try {
      const started = await controls.startWave({ mood });
      if (!started) toast.error('Не удалось запустить поток по настроению');
    } finally {
      setLoading(null);
    }
  }

  if (moods.length === 0) return null;

  const hiddenCount = moods.length - COLLAPSED_LIMIT;
  const visible = expanded ? moods : moods.slice(0, COLLAPSED_LIMIT);

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map(({ mood }) => (
        <motion.button
          key={mood}
          type="button"
          onClick={() => start(mood)}
          disabled={loading !== null}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.04 }}
          transition={spring.snappy}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
        >
          {loading === mood ? (
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          ) : (
            <PlayIcon size={9} className="opacity-50" />
          )}
          {MOOD_LABELS[mood]}
        </motion.button>
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? 'Свернуть' : `Ещё ${hiddenCount}`}
        </button>
      )}
    </div>
  );
}


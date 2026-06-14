'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { MOOD_LABELS, type Mood } from '@/lib/moods';
import { controls } from '@/components/player/audio-engine';
import { PlayIcon } from '@/components/icons';
import type { PlayerTrack } from '@/store/player';
import { toast } from '@/components/toast';

export interface MoodChip {
  mood: Mood;
  count: number;
}

type WaveApiTrack = {
  id: string; title: string; artistName: string;
  artistSlug: string; releaseId: string;
  coverUrl: string | null; accentColor: string | null;
};

/**
 * Чипы тегов настроения на главной: клик запускает волну с трека с этим тегом
 * (seed-режим волны с mood-фильтром), дальше похожесть ведёт поток сама.
 */
export function MoodWaveChips({ moods }: { moods: MoodChip[] }) {
  const [loading, setLoading] = useState<Mood | null>(null);

  async function start(mood: Mood) {
    if (loading) return;
    setLoading(mood);
    try {
      const res = await fetch(`/api/v1/wave?mood=${mood}`).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { track: WaveApiTrack | null }) : null;
      if (!data?.track) {
        toast.error('Не удалось запустить поток по настроению');
        return;
      }
      const track: PlayerTrack = {
        id: data.track.id,
        title: data.track.title,
        artistName: data.track.artistName,
        artistSlug: data.track.artistSlug,
        releaseId: data.track.releaseId,
        coverUrl: data.track.coverUrl,
        accentColor: data.track.accentColor ?? undefined,
      };
      controls.play(track, [track], 0);
      controls.setWaveMode(true);
    } finally {
      setLoading(null);
    }
  }

  if (moods.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {moods.map(({ mood }) => (
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
    </div>
  );
}


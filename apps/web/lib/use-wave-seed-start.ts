'use client';

import { useState } from 'react';
import { controls } from '@/lib/player/audio-engine';
import { toast } from '@/lib/toast';

export interface WaveSeedTag {
  key: string;
  kind: 'mood' | 'genre';
}

const ERROR_TEXT: Record<WaveSeedTag['kind'], string> = {
  mood: 'Не удалось запустить поток по настроению',
  genre: 'Не удалось запустить поток по жанру',
};

/** Общий старт волны по seed-тегу (чипы главной + шит «Все теги»): loading-ключ + toast на неуспех. */
export function useWaveSeedStart() {
  const [loading, setLoading] = useState<string | null>(null);

  async function start(tag: WaveSeedTag): Promise<boolean> {
    if (loading) return false;
    setLoading(tag.key);
    try {
      const seed = tag.kind === 'mood' ? { mood: tag.key } : { genre: tag.key };
      const started = await controls.startWave(seed);
      if (!started) toast.error(ERROR_TEXT[tag.kind]);
      return started;
    } finally {
      setLoading(null);
    }
  }

  return { loading, start };
}

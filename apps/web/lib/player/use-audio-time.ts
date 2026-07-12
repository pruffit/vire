'use client';

import { useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/player';
import { getAudioTime } from './audio-engine';

/** Чистая функция — тестируется без рендера хука. */
export function shouldRunTicker(enabled: boolean, isPlaying: boolean): boolean {
  return enabled && isPlaying;
}

/**
 * Живое время воспроизведения — читает `audio.currentTime` через rAF мимо стора,
 * ререндерится только подписавшийся лист. `enabled=false` (нерелевантный потребитель)
 * не тикает и не пересинхронизируется — возвращает последнее значение.
 */
export function useAudioTime(fps = 4, enabled = true): number {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const storeTime = usePlayerStore((s) => s.currentTime);
  // Пока движок не подключен к треку, getAudioTime() читает пустой/чужой <audio> — берём время из стора.
  const hasAudioFallback = usePlayerStore((s) => (enabled && !s.hasAudio ? s.currentTime : null));
  const [time, setTime] = useState(getAudioTime);

  // Досинхронизация на паузу/seek/смену трека — во время рендера («adjusting state
  // when a prop changes»), не эффектом: setState в эффекте — лишний каскад ререндеров.
  const [prevKey, setPrevKey] = useState<[boolean, number]>([isPlaying, storeTime]);
  if (enabled && (prevKey[0] !== isPlaying || prevKey[1] !== storeTime)) {
    setPrevKey([isPlaying, storeTime]);
    setTime(getAudioTime());
  }

  useEffect(() => {
    if (!shouldRunTicker(enabled, isPlaying)) return;
    const interval = 1000 / fps;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last >= interval) {
        last = now;
        setTime(getAudioTime());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, fps, enabled]);

  return hasAudioFallback ?? time;
}

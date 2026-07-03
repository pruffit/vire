'use client';

import { useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/player';
import { getAudioTime } from '@/components/player/audio-engine';

/**
 * Живое время воспроизведения для визуальных потребителей (скраббер, тайминги,
 * подсветка текста) — читает `audio.currentTime` напрямую мимо стора, поэтому
 * ререндерится только сам компонент-лист, а не всё дерево плеера.
 *
 * На паузе rAF не крутится: один финальный sync при переходе isPlaying→false,
 * плюс досинхронизация на любую запись currentTime в стор (seek/смена трека/
 * редкий персист-тик) — так скраб при паузе тоже подхватывается сразу.
 */
export function useAudioTime(fps = 4): number {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const storeTime = usePlayerStore((s) => s.currentTime);
  const [time, setTime] = useState(getAudioTime);

  // Пересинхронизация на isPlaying (вкл. финальный sync при уходе в паузу) и на
  // любую запись currentTime в стор (seek/смена трека/5с-тик) — правим state
  // прямо во время рендера (react.dev: «adjusting state when a prop changes»),
  // не эффектом: setState синхронно в эффекте — лишний каскад ререндеров.
  const [prevKey, setPrevKey] = useState<[boolean, number]>([isPlaying, storeTime]);
  if (prevKey[0] !== isPlaying || prevKey[1] !== storeTime) {
    setPrevKey([isPlaying, storeTime]);
    setTime(getAudioTime());
  }

  useEffect(() => {
    if (!isPlaying) return;
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
  }, [isPlaying, fps]);

  return time;
}

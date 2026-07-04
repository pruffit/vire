'use client';

import { useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/player';
import { getAudioTime } from '@/components/player/audio-engine';

/** rAF-тикер имеет смысл заводить только активному листу с реально играющим
 *  звуком — неактивный элемент списка (waveform чужого трека в трек-листе,
 *  лирика не текущего трека) передаёт `enabled=false` и не подписывается на
 *  тики вовсе. Чистая функция — тестируется без рендера хука. */
export function shouldRunTicker(enabled: boolean, isPlaying: boolean): boolean {
  return enabled && isPlaying;
}

/**
 * Живое время воспроизведения для визуальных потребителей (скраббер, тайминги,
 * подсветка текста) — читает `audio.currentTime` напрямую мимо стора, поэтому
 * ререндерится только сам компонент-лист, а не всё дерево плеера.
 *
 * `enabled=false` — для нерелевантного потребителя (неактивный трек в списке,
 * не текущий трек в лирике): хук не крутит rAF (см. `shouldRunTicker`) и не
 * пересинхронизируется на изменения стора — возвращает статичное последнее
 * значение вместо того, чтобы тикать 4 раза/сек, пока играет ЛЮБОЙ трек.
 *
 * На паузе rAF не крутится: один финальный sync при переходе isPlaying→false,
 * плюс досинхронизация на любую запись currentTime в стор (seek/смена трека/
 * редкий персист-тик) — так скраб при паузе тоже подхватывается сразу.
 *
 * Restored-фолбэк: сразу после F5 движок ещё не подключен к треку (`hasAudio`
 * false), `getAudioTime()` читает пустой `<audio>` и врёт 0 — пока восстановленный
 * трек ждёт первый play (`restored` true), берём время из стора (персистится там же).
 * Один комбинированный селектор вместо двух отдельных подписок на hasAudio/restored —
 * не-restored (обычный) путь всегда получает null и не переренднивается лишний раз.
 */
export function useAudioTime(fps = 4, enabled = true): number {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const storeTime = usePlayerStore((s) => s.currentTime);
  const restoredFallback = usePlayerStore((s) => (enabled && !s.hasAudio && s.restored ? s.currentTime : null));
  const [time, setTime] = useState(getAudioTime);

  // Пересинхронизация на isPlaying (вкл. финальный sync при уходе в паузу) и на
  // любую запись currentTime в стор (seek/смена трека/5с-тик) — правим state
  // прямо во время рендера (react.dev: «adjusting state when a prop changes»),
  // не эффектом: setState синхронно в эффекте — лишний каскад ререндеров.
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

  return restoredFallback ?? time;
}

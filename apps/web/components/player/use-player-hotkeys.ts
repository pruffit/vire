'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/store/player';
import { controls, getAudioTime } from './audio-engine';

const SEEK_STEP_SEC = 5;

/** Элементы, у которых свои клавиатурные взаимодействия — их не перехватываем
 *  (поля ввода, кнопки — пробел жмёт их, waveform-слайдер — стрелки его двигают). */
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest(
    'input, textarea, select, button, a, audio, video, [contenteditable], [role="slider"], [role="button"]',
  ) !== null;
}

/**
 * Глобальные клавиши плеера: пробел = play/pause, ←/→ = перемотка ±5с.
 * Работают только когда трек загружен и фокус не на интерактивном элементе.
 */
export function usePlayerHotkeys(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isInteractive(e.target)) return;

      const { track, hasAudio, duration } = usePlayerStore.getState();
      if (!track || !hasAudio) return;

      // Стор пишет currentTime редко (seek/смена трека/5с-тик) — для расчёта
      // нового таймкода читаем актуальную позицию напрямую из audio-движка.
      const currentTime = getAudioTime();

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          controls.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          controls.seek(Math.max(0, currentTime - SEEK_STEP_SEC));
          break;
        case 'ArrowRight':
          e.preventDefault();
          controls.seek(duration > 0 ? Math.min(duration, currentTime + SEEK_STEP_SEC) : currentTime + SEEK_STEP_SEC);
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

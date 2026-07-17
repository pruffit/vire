'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/store/player';
import { controls, getAudioTime } from '@/lib/player/audio-engine';

const SEEK_STEP_SEC = 5;

/** Элементы со своими клавиатурными взаимодействиями — их не перехватываем. */
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest(
    'input, textarea, select, button, a, audio, video, [contenteditable], [role="slider"], [role="button"]',
  ) !== null;
}

export function usePlayerHotkeys(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isInteractive(e.target)) return;

      const { track, hasAudio, duration } = usePlayerStore.getState();
      if (!track || !hasAudio) return;

      // Стор пишет currentTime редко — актуальную позицию читаем напрямую из движка.
      const currentTime = getAudioTime();

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          controls.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) controls.prev();
          else controls.seek(Math.max(0, currentTime - SEEK_STEP_SEC));
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) void controls.next();
          else controls.seek(duration > 0 ? Math.min(duration, currentTime + SEEK_STEP_SEC) : currentTime + SEEK_STEP_SEC);
          break;
        case 'KeyM':
          controls.toggleMute();
          break;
        case 'KeyR':
          controls.cycleRepeat();
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

'use client';

import { useEffect } from 'react';
import { controls } from './player/audio-engine';
import { usePlayerStore } from '@/store/player';

export function KeyboardShortcuts() {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return;

      const { track, currentTime, duration } = usePlayerStore.getState();

      switch (e.code) {
        case 'Space':
          if (!track) return;
          e.preventDefault();
          controls.togglePlay();
          break;
        case 'ArrowRight':
          if (!track || e.metaKey || e.ctrlKey || e.altKey) return;
          e.preventDefault();
          if (e.shiftKey) controls.next();
          else controls.seek(Math.min(duration, currentTime + 5));
          break;
        case 'ArrowLeft':
          if (!track || e.metaKey || e.ctrlKey || e.altKey) return;
          e.preventDefault();
          if (e.shiftKey) controls.prev();
          else controls.seek(Math.max(0, currentTime - 5));
          break;
        case 'KeyM':
          if (!track) return;
          controls.toggleMute();
          break;
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return null;
}

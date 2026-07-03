'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { initAudioEngine } from './audio-engine';
import { usePlayerHotkeys } from './use-player-hotkeys';
import { MiniBar } from './mini-bar';
import { FullscreenPlayer } from './fullscreen';

/**
 * Координатор глобального плеера: мини-бар (поток app-shell, h-16) + фуллскрин
 * (fixed-оверлей). Сам не рисует ничего — раскладка/дизайн внутри mini-bar.tsx
 * и fullscreen.tsx, очередь — в queue-panel.tsx.
 */
export function Player() {
  const [expanded, setExpanded] = useState(false);
  const [queueOnOpen, setQueueOnOpen] = useState(false);

  useEffect(() => {
    initAudioEngine();
  }, []);
  usePlayerHotkeys();

  const track = usePlayerStore((s) => s.track);

  useEffect(() => {
    document.documentElement.style.setProperty('--player-h', track ? '4rem' : '0px');
    return () => document.documentElement.style.setProperty('--player-h', '0px');
  }, [track]);

  function openFullscreen(withQueue: boolean) {
    setQueueOnOpen(withQueue);
    setExpanded(true);
  }

  return (
    <>
      {/* Мини-бар: всплывает снизу при появлении трека, уезжает вниз при сбросе. */}
      <AnimatePresence>
        {track && (
          <motion.div
            key="player-bar"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={spring.smooth}
            className="relative shrink-0 h-16 border-t border-border overflow-hidden"
            style={{ '--artist-accent': track.accentColor ?? undefined } as React.CSSProperties}
          >
            <MiniBar
              ticking={!expanded}
              onExpandCover={() => openFullscreen(false)}
              onOpenQueue={() => openFullscreen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Фуллскрин: обложка разворачивается из мини-бара (shared layoutId). */}
      <AnimatePresence>
        {expanded && track && (
          <FullscreenPlayer onClose={() => setExpanded(false)} initialShowQueue={queueOnOpen} />
        )}
      </AnimatePresence>
    </>
  );
}

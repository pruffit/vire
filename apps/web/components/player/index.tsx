'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { initAudioEngine } from '@/lib/player/audio-engine';
import '@/lib/desktop-bridge';
import { usePlayerHotkeys } from './use-player-hotkeys';
import { MiniBar } from './mini-bar';
import { FullscreenPlayer } from './fullscreen';

/** Координатор глобального плеера: мини-бар (поток app-shell) + фуллскрин (fixed-оверлей). */
export function Player() {
  const [expanded, setExpanded] = useState(false);
  const [queueOnOpen, setQueueOnOpen] = useState(false);

  useEffect(() => {
    initAudioEngine();
  }, []);
  usePlayerHotkeys();

  const track = usePlayerStore((s) => s.track);
  const jamOverride = usePlayerStore((s) => s.jamOverride);
  const showBar = Boolean(track || jamOverride);

  useEffect(() => {
    document.documentElement.style.setProperty('--player-h', showBar ? '4rem' : '0px');
    return () => document.documentElement.style.setProperty('--player-h', '0px');
  }, [showBar]);

  // Джем-takeover перехватывает mini-bar — фуллскрин с чужим треком не должен всплыть поверх; поправка
  // во время рендера (не в эффекте — react-hooks/set-state-in-effect), по образцу use-jam-queue.ts.
  if (jamOverride && expanded) setExpanded(false);

  function openFullscreen(withQueue: boolean) {
    setQueueOnOpen(withQueue);
    setExpanded(true);
  }

  return (
    <>
      <AnimatePresence>
        {showBar && (
          <motion.div
            key="player-bar"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={spring.smooth}
            className="relative shrink-0 h-16 border-t border-border overflow-hidden"
            style={{ '--artist-accent': track?.accentColor ?? undefined } as React.CSSProperties}
          >
            <MiniBar
              ticking={!expanded}
              onExpandCover={() => openFullscreen(false)}
              onOpenQueue={() => openFullscreen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expanded && track && !jamOverride && (
          <FullscreenPlayer onClose={() => setExpanded(false)} initialShowQueue={queueOnOpen} />
        )}
      </AnimatePresence>
    </>
  );
}

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { PlayIcon } from '@/components/icons';
import { toast } from '@/lib/toast';

export function WaveStartButton() {
  const waveMode = usePlayerStore((s) => s.waveMode);
  const currentTrack = usePlayerStore((s) => s.track);
  const isActive = waveMode && !!currentTrack;
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    if (loading) return;
    setLoading(true);
    try {
      const started = await controls.startWave(null);
      if (!started) toast.error('Не удалось запустить поток');
    } finally {
      setLoading(false);
    }
  }

  function handleStop() {
    controls.stopWave();
  }

  return (
    <div className="flex items-center gap-4 py-3.5 border-y border-border">
      <div className="shrink-0 text-muted-foreground" aria-hidden="true">
        <WaveIcon active={isActive} />
      </div>

      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          {isActive ? (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={spring.snappy}
              className="flex items-center gap-2 min-w-0"
            >
              <span className="text-sm font-medium">Поток запущен</span>
              <PlayingBars />
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                {currentTrack?.title} · {currentTrack?.artistName}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={spring.snappy}
            >
              <span className="text-sm font-medium">Поток</span>
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                непрерывное радио из похожих треков
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {isActive ? (
          <motion.button
            key="stop"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring.snappy}
            onClick={handleStop}
            whileTap={{ scale: 0.94 }}
            className="shrink-0 py-3 -my-3 px-2 -mx-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Остановить
          </motion.button>
        ) : (
          <motion.button
            key="start"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring.snappy}
            onClick={handleStart}
            disabled={loading}
            whileTap={{ scale: 0.94 }}
            className="shrink-0 flex items-center gap-1.5 py-3 -my-3 px-2 -mx-2 text-sm font-medium text-foreground hover:opacity-70 transition-opacity disabled:opacity-40"
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <PlayIcon size={13} />
            )}
            Запустить
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function WaveIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <motion.path
        d="M2 12 C4.5 6, 7.5 6, 10 12 C12.5 18, 15.5 18, 18 12 C20.5 6, 22 6, 22 12"
        animate={active ? { pathLength: [1, 0.6, 1], opacity: [1, 0.7, 1] } : { pathLength: 1, opacity: 0.5 }}
        transition={active ? { repeat: Infinity, duration: 2.4, ease: 'easeInOut' } : { duration: 0.3 }}
      />
    </svg>
  );
}

function PlayingBars() {
  return (
    <span className="flex items-end gap-px h-3 shrink-0" aria-hidden="true">
      {[0, 0.15, 0.3].map((d) => (
        <motion.span
          key={d}
          className="w-0.5 rounded-full bg-primary"
          animate={{ height: ['4px', '10px', '4px'] }}
          transition={{ repeat: Infinity, duration: 0.9, delay: d, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}


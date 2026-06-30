'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon } from '@/components/icon';
import { LyricsScroll } from '@/components/lyrics-scroll';
import type { LyricLine } from '@/lib/lrc';

/**
 * Текст трека в фуллскрин-плеере. Тянется лениво (по trackId), показывается
 * тоглом «Текст». Синхронизированный — подсвечивает активную строку по времени
 * и доскролливает к ней; клик по строке перематывает на её таймкод.
 * Родитель должен ставить key={trackId}, чтобы состояние сбрасывалось на новый трек.
 */
export function Lyrics({ trackId }: { trackId: string }) {
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/tracks/${trackId}/lyrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { lyrics?: LyricLine[] | null } | null) => {
        if (!cancelled) setLines(d?.lyrics ?? []);
      })
      .catch(() => {
        if (!cancelled) setLines([]);
      });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  const loading = lines === null;
  const hasLyrics = !loading && lines.length > 0;
  const buttonDisabled = loading || !hasLyrics;

  return (
    <div className="w-full" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        disabled={buttonDisabled}
        aria-expanded={!buttonDisabled ? open : undefined}
        title={!loading && !hasLyrics ? 'Нет текста' : undefined}
        className="mx-auto flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
      >
        <Icon name="align-left" size={15} />
        {open && hasLyrics ? 'Скрыть текст' : 'Текст'}
      </button>
      <AnimatePresence initial={false}>
        {open && hasLyrics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            <LyricsScroll lines={lines} variant="player" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

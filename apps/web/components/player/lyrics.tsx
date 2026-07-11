'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon } from '@/components/icon';
import { LyricsScroll } from '@/components/lyrics-scroll';
import type { LyricLine } from '@/lib/lrc';

// Модульный FIFO-кэш: фуллскрин ремонтирует Lyrics на каждый показ, без кэша фетч дублировался.
const LYRICS_CACHE_LIMIT = 20;
const lyricsCache = new Map<string, LyricLine[] | null>();

function cacheLyrics(trackId: string, lines: LyricLine[] | null): void {
  if (lyricsCache.size >= LYRICS_CACHE_LIMIT && !lyricsCache.has(trackId)) {
    const oldest = lyricsCache.keys().next().value;
    if (oldest !== undefined) lyricsCache.delete(oldest);
  }
  lyricsCache.set(trackId, lines);
}

/** Текст трека в фуллскрин-плеере. Родитель должен ставить key={trackId} — сброс состояния на новый трек. */
export function Lyrics({ trackId }: { trackId: string }) {
  const [lines, setLines] = useState<LyricLine[] | null>(() => lyricsCache.get(trackId) ?? null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (lyricsCache.has(trackId)) return;
    let cancelled = false;
    fetch(`/api/v1/tracks/${trackId}/lyrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { lyrics?: LyricLine[] | null } | null) => {
        const value = d?.lyrics ?? [];
        cacheLyrics(trackId, value);
        if (!cancelled) setLines(value);
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
    <div className="w-full">
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

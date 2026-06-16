'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { controls } from './audio-engine';
import { Icon } from '@/components/icon';
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

  if (!lines || lines.length === 0) return null;

  return (
    <div className="w-full" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        className="mx-auto flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Icon name="align-left" size={15} />
        {open ? 'Скрыть текст' : 'Текст'}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            <LyricsScroll lines={lines} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LyricsScroll({ lines }: { lines: LyricLine[] }) {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const synced = lines.some((l) => l.t != null);
  // Активная строка — последняя, чей таймкод уже наступил.
  let active = -1;
  if (synced) {
    for (let i = 0; i < lines.length; i++) {
      if ((lines[i].t ?? Infinity) <= currentTime + 0.15) active = i;
    }
  }

  // Доскролл к активной строке — внутри контейнера, не трогая внешний скролл.
  useEffect(() => {
    const c = containerRef.current;
    const a = activeRef.current;
    if (!c || !a) return;
    c.scrollTo({ top: a.offsetTop - c.clientHeight / 2 + a.clientHeight / 2, behavior: 'smooth' });
  }, [active]);

  return (
    <div ref={containerRef} className="mt-3 max-h-64 overflow-y-auto py-2 text-center space-y-2.5">
      {lines.map((l, i) => {
        const isActive = i === active;
        const seekable = l.t != null;
        return (
          <button
            key={i}
            ref={isActive ? activeRef : null}
            type="button"
            disabled={!seekable}
            onClick={() => seekable && controls.seek(l.t as number)}
            className={`block w-full px-2 leading-snug transition-all duration-300 ${
              seekable ? 'cursor-pointer' : 'cursor-default'
            } ${
              isActive
                ? 'text-base font-medium text-foreground'
                : synced
                  ? 'text-sm text-muted-foreground/45 hover:text-muted-foreground'
                  : 'text-sm text-muted-foreground'
            }`}
          >
            {l.text || '♪'}
          </button>
        );
      })}
    </div>
  );
}

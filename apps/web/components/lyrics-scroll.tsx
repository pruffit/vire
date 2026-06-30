'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/components/player/audio-engine';
import type { LyricLine } from '@/lib/lrc';

interface LyricsScrollProps {
  lines: LyricLine[];
  variant?: 'player' | 'artist';
  trackId?: string;
  onSeekTo?: (t: number) => void;
}

export function LyricsScroll({ lines, variant = 'player', trackId, onSeekTo = controls.seek }: LyricsScrollProps) {
  // Гард синхрона в селекторе: если играет не этот трек — отдаём -1, и Zustand не
  // дёргает ре-рендер на каждый тик чужого трека. -1 не совпадёт ни с одним таймкодом.
  const tick = usePlayerStore((s) =>
    trackId == null || s.track?.id === trackId ? s.currentTime : -1,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const synced = lines.some((l) => l.t != null);
  // Активная строка — последняя, чей таймкод уже наступил.
  let active = -1;
  if (synced && tick >= 0) {
    for (let i = 0; i < lines.length; i++) {
      if ((lines[i].t ?? Infinity) <= tick + 0.15) active = i;
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
            onClick={() => seekable && onSeekTo(l.t as number)}
            className={`block w-full px-2 leading-snug transition-all duration-300 ${
              seekable ? 'cursor-pointer' : 'cursor-default'
            } ${lineClassName(variant, isActive, synced)}`}
          >
            {l.text || '♪'}
          </button>
        );
      })}
    </div>
  );
}

function lineClassName(variant: 'player' | 'artist', isActive: boolean, synced: boolean): string {
  if (variant === 'artist') {
    if (isActive) return 'text-base font-medium text-[var(--artist-text)]';
    if (synced) {
      return 'text-sm text-[color-mix(in_oklch,var(--artist-text)_40%,transparent)] hover:text-[color-mix(in_oklch,var(--artist-text)_72%,transparent)]';
    }
    return 'text-sm text-[color-mix(in_oklch,var(--artist-text)_55%,transparent)]';
  }

  if (isActive) return 'text-base font-medium text-foreground';
  if (synced) return 'text-sm text-muted-foreground/45 hover:text-muted-foreground';
  return 'text-sm text-muted-foreground';
}

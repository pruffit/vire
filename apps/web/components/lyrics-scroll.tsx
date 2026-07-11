'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/components/player/audio-engine';
import { useAudioTime } from '@/lib/player/use-audio-time';
import { findActiveLrcLine, type LyricLine } from '@/lib/lrc';

interface LyricsScrollProps {
  lines: LyricLine[];
  variant?: 'player' | 'artist';
  trackId?: string;
  onSeekTo?: (t: number) => void;
}

export function LyricsScroll({ lines, variant = 'player', trackId, onSeekTo = controls.seek }: LyricsScrollProps) {
  // время из useAudioTime, не store.currentTime (тот пишется редко — для подсветки не годится);
  // чужой трек → тик -1 и хук не тикает вовсе
  const isThisTrack = usePlayerStore((s) => trackId == null || s.track?.id === trackId);
  const liveTime = useAudioTime(4, isThisTrack);
  const tick = isThisTrack ? liveTime : -1;

  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const synced = useMemo(() => lines.some((l) => l.t != null), [lines]);

  const active = useMemo(() => (synced ? findActiveLrcLine(lines, tick) : -1), [lines, synced, tick]);

  const recenter = useCallback((behavior: ScrollBehavior) => {
    const c = containerRef.current;
    const a = activeRef.current;
    if (!c || !a) return;
    c.scrollTo({ top: a.offsetTop - c.clientHeight / 2 + a.clientHeight / 2, behavior });
  }, []);

  useEffect(() => {
    recenter('smooth');
  }, [active, recenter]);

  // при анимации высоты контейнера (height 0→auto) центр съезжает — довскролливаем на ресайз
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => recenter('instant'));
    ro.observe(c);
    return () => ro.disconnect();
  }, [recenter]);

  return (
    <div
      ref={containerRef}
      className="relative mt-3 max-h-[40vh] md:max-h-64 overflow-y-auto overscroll-contain touch-pan-y no-scrollbar [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
    >
      {/* паддинг на спейсере, не на контейнере — иначе крайние строки не доскролливаются
          в центр и попадают в фейд маски */}
      <div className="py-[20vh] md:py-24 text-center space-y-2.5">
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

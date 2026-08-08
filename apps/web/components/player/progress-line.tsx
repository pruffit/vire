'use client';

import { useRef, useState } from 'react';
import { useIsDesktopPointer } from '@/lib/is-desktop-pointer';
import { ratioFromX } from '@/lib/player/waveform-math';

interface Props {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
}

/** Линия прогресса по верхней кромке бара — единственная перемотка на мобилке. Общая для обычного мини-бара и режима джема. */
export function ProgressLine({ position, duration, onSeek }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  // Hover-утолщение только на десктопе — на таче :hover залипает после тапа.
  const isDesktop = useIsDesktopPointer();
  const shown = scrub ?? (duration > 0 ? position / duration : 0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!duration || !ref.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(ratioFromX(e.clientX, ref.current.getBoundingClientRect()));
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (scrub === null || !duration || !ref.current) return;
    setScrub(ratioFromX(e.clientX, ref.current.getBoundingClientRect()));
  }
  function commit() {
    if (scrub === null || !duration) return;
    onSeek(scrub * duration);
    setScrub(null);
  }

  const dragging = scrub !== null;

  return (
    // Зона касания 12px, видимая полоска — 2px у кромки.
    <div
      ref={ref}
      role="slider"
      aria-label="Перемотка"
      aria-valuenow={Math.round(shown * duration)}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={commit}
      onPointerCancel={() => setScrub(null)}
      className="absolute z-20 top-0 left-0 right-0 h-3 flex items-start touch-none cursor-pointer group"
    >
      <div
        className={`relative w-full bg-foreground/5 transition-[height] ${
          dragging ? 'h-[3px]' : isDesktop ? 'h-[2px] group-hover:h-[3px]' : 'h-[2px]'
        }`}
      >
        <div
          className={dragging ? 'h-full' : 'h-full transition-[width] duration-100 ease-linear'}
          style={{
            width: `${shown * 100}%`,
            background: 'var(--artist-accent, oklch(72% 0.19 145))',
            opacity: dragging ? 1 : 0.85,
          }}
        >
          {isDesktop && !dragging && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'var(--artist-accent, oklch(72% 0.19 145))' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

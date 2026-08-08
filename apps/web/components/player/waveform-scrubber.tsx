'use client';

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useAudioTime } from '@/lib/player/use-audio-time';
import { buildBars, ratioFromX } from '@/lib/player/waveform-math';

const SVG_H = 100;
const BAR_W = 2;
const BAR_GAP = 1;
const SEEK_STEP_SEC = 5;

export interface WaveformMarker {
  /** Позиция 0..1 вдоль длительности трека */
  ratio: number;
  count: number;
}

interface WaveformScrubberProps {
  peaks: number[] | null;
  barCount?: number;
  markers?: WaveformMarker[];
  onSeek(time: number): void;
  duration: number;
  className?: string;
  ariaLabel?: string;
  /** false — прогресс/скраб/клавиатура отключены (не «этот» трек в списке);
   *  клик по-прежнему работает через onActivate. По умолчанию true. */
  active?: boolean;
  onActivate?: () => void;
  /** Декоративная акцентная полоска под волной, ярчеющая на hover группы —
   *  ожидает, что родитель обернёт скраббер в контейнер с классом `group`. */
  hoverAccent?: boolean;
}

export function WaveformScrubber({
  peaks,
  barCount = 80,
  markers,
  onSeek,
  duration,
  className,
  ariaLabel = 'Перемотка',
  active = true,
  onActivate,
  hoverAccent = false,
}: WaveformScrubberProps) {
  const liveTime = useAudioTime(4, active);
  const svgRef = useRef<SVGSVGElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);

  const bars = useMemo(() => buildBars(peaks, barCount), [peaks, barCount]);

  const dragging = scrub !== null;
  const progress = active ? (scrub ?? (duration > 0 ? liveTime / duration : 0)) : 0;

  function rectOf(el: SVGSVGElement) {
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width };
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    if (!active || !duration) return;
    e.stopPropagation(); // не запускать dismiss-свайп фуллскрина
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(ratioFromX(e.clientX, rectOf(e.currentTarget)));
  }
  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (scrub === null || !duration) return;
    setScrub(ratioFromX(e.clientX, rectOf(e.currentTarget)));
  }
  function commit() {
    if (scrub === null || !duration) return;
    onSeek(scrub * duration);
    setScrub(null);
  }
  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (!active || !duration) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSeek(Math.min(duration, liveTime + SEEK_STEP_SEC));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSeek(Math.max(0, liveTime - SEEK_STEP_SEC));
    }
  }
  function handleClick() {
    if (!active) onActivate?.();
  }

  const SVG_W = barCount * (BAR_W + BAR_GAP);
  const maxMarker = markers?.reduce((m, b) => Math.max(m, b.count), 0) ?? 0;

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={commit}
        onPointerCancel={() => setScrub(null)}
        onKeyDown={onKeyDown}
        tabIndex={active ? 0 : undefined}
        aria-label={active ? ariaLabel : 'Воспроизвести'}
        role={active ? 'slider' : 'button'}
        aria-valuenow={active ? Math.round(progress * duration) : undefined}
        aria-valuemin={active ? 0 : undefined}
        aria-valuemax={active ? Math.round(duration) : undefined}
        className={`select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm ${
          active ? 'touch-none' : ''
        } ${dragging ? 'cursor-grabbing' : 'cursor-pointer'} ${className ?? ''}`}
      >
        {bars.map((peak, i) => {
          const h = Math.max(2, peak * (SVG_H - 4));
          const x = i * (BAR_W + BAR_GAP);
          const played = i / barCount < progress;
          return (
            <rect
              key={i}
              x={x}
              y={(SVG_H - h) / 2}
              width={BAR_W}
              height={h}
              rx={0.5}
              style={{
                fill: played ? 'var(--artist-accent, rgba(255,255,255,0.75))' : 'rgba(255,255,255,0.18)',
                transition: dragging ? 'none' : 'fill 0.12s linear',
              }}
            />
          );
        })}

        {markers?.map((m) => {
          const x = m.ratio * SVG_W;
          const intensity = maxMarker > 0 ? m.count / maxMarker : 0;
          const radius = 2 + intensity * 3.5;
          const opacity = 0.4 + intensity * 0.55;
          return (
            <circle
              key={m.ratio}
              cx={x}
              cy={SVG_H - 4}
              r={radius}
              fill="var(--artist-accent, rgba(255,255,255,0.7))"
              opacity={opacity}
            />
          );
        })}

        {active && duration > 0 && (
          <rect
            x={Math.min(SVG_W - 1, Math.max(0, progress * SVG_W - 0.5))}
            y={0}
            width={1}
            height={SVG_H}
            style={{ fill: 'var(--artist-accent, rgba(255,255,255,0.9))', opacity: dragging ? 0.9 : 0.5 }}
          />
        )}
      </svg>

      {hoverAccent && duration > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="absolute bottom-1 w-px h-full bg-[var(--artist-accent)] opacity-40"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      )}
    </>
  );
}

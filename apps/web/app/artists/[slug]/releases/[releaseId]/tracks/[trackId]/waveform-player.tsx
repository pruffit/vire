'use client';

import { useEffect, useCallback, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls, initAudioEngine } from '@/components/player/audio-engine';
import { TrackShare } from '@/components/track-share';
import { PlayIcon, PauseIcon, HeartIcon } from '@/components/icons';
import { formatDuration } from '@/lib/format';
import type { MomentBucket } from '@vire/db';

const BAR_COUNT = 120;
const SVG_H = 100;
const BAR_W = 2;
const BAR_GAP = 1;
const SVG_W = BAR_COUNT * (BAR_W + BAR_GAP);

interface Props {
  track: PlayerTrack;
  queue: PlayerTrack[];
  queueIndex: number;
  peaks: number[] | null;
  moments: MomentBucket[];
  trackId: string;
  /** Автоматически перемотать к этой секунде при загрузке */
  seekTo?: number;
}

export function TrackWaveformPlayer({
  track,
  queue,
  queueIndex,
  peaks,
  moments,
  trackId,
  seekTo,
}: Props) {
  const didSeek = useRef(false);

  useEffect(() => {
    initAudioEngine();
  }, []);

  const currentTrackId = usePlayerStore((s) => s.track?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  const svgRef = useRef<SVGSVGElement>(null);
  // Скраб (0..1) при перетаскивании активного трека: визуал мгновенно, seek —
  // на отпускании. Когда трек не играет, волна работает как «play» по тапу.
  const [scrub, setScrub] = useState<number | null>(null);

  const isThisTrack = currentTrackId === track.id;
  const progress = scrub ?? (isThisTrack && duration > 0 ? currentTime / duration : 0);

  // Seek to ?t= param after track loads
  useEffect(() => {
    if (!seekTo || didSeek.current || !isThisTrack || duration <= 0) return;
    didSeek.current = true;
    controls.seek(Math.min(seekTo, duration - 1));
  }, [seekTo, isThisTrack, duration]);

  function ratioFromX(clientX: number): number {
    const el = svgRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  }
  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    // Не этот трек → не скраббим: тап запустит воспроизведение через onClick.
    if (!isThisTrack || !duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(ratioFromX(e.clientX));
  }
  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (scrub === null || !duration) return;
    setScrub(ratioFromX(e.clientX));
  }
  function commitScrub() {
    if (scrub === null || !duration) return;
    controls.seek(scrub * duration);
    setScrub(null);
  }
  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (!isThisTrack || !duration) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      controls.seek(Math.min(duration, currentTime + 5));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      controls.seek(Math.max(0, currentTime - 5));
    }
  }

  // Клик нужен только чтобы запустить трек, который сейчас не играет: перемотку
  // активного трека целиком ведёт pointer-скраб (тап = down+up на одной точке).
  function handleWaveformClick() {
    if (!isThisTrack) controls.play(track, queue, queueIndex);
  }

  function handlePlayPause() {
    if (isThisTrack) controls.togglePlay();
    else controls.play(track, queue, queueIndex);
  }

  /** Добавить любимый момент в текущей позиции */
  const handleMarkMoment = useCallback(() => {
    if (!isThisTrack || !duration) return;
    const positionSec = Math.round(currentTime);
    fetch(`/api/v1/tracks/${trackId}/moments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionSec }),
    }).catch(() => {});
  }, [isThisTrack, duration, currentTime, trackId]);

  const bars = buildBars(peaks);

  // Нормализуем моменты для отрисовки поверх волны
  const maxMoment = moments.reduce((m, b) => Math.max(m, b.count), 0);

  return (
    <div className="space-y-3">
      {/* Waveform + момент-маркеры */}
      <div className="relative group">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="none"
          onClick={handleWaveformClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={commitScrub}
          onPointerCancel={() => setScrub(null)}
          onKeyDown={onKeyDown}
          tabIndex={isThisTrack ? 0 : undefined}
          aria-label={isThisTrack ? 'Перемотка' : 'Воспроизвести'}
          role={isThisTrack ? 'slider' : 'button'}
          aria-valuenow={isThisTrack ? Math.round(progress * duration) : undefined}
          aria-valuemin={isThisTrack ? 0 : undefined}
          aria-valuemax={isThisTrack ? Math.round(duration) : undefined}
          // touch-none только для активного трека (режим скраба) — иначе на
          // мобилке палец не сможет проскроллить страницу мимо большой волны.
          className={`w-full h-24 sm:h-28 select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded ${
            isThisTrack ? 'touch-none' : ''
          } ${scrub !== null ? 'cursor-grabbing' : 'cursor-pointer'}`}
        >
          {bars.map((peak, i) => {
            const h = Math.max(2, peak * (SVG_H - 8));
            const x = i * (BAR_W + BAR_GAP);
            const played = i / BAR_COUNT < progress;
            return (
              <rect
                key={i}
                x={x}
                y={(SVG_H - h) / 2}
                width={BAR_W}
                height={h}
                rx={1}
                fill={
                  played
                    ? 'var(--artist-accent, rgba(255,255,255,0.8))'
                    : 'rgba(255,255,255,0.15)'
                }
              />
            );
          })}

          {/* Агрегированные моменты — точки снизу */}
          {duration > 0 && moments.map((bucket) => {
            const frac = bucket.positionSec / duration;
            const x = frac * SVG_W;
            const intensity = maxMoment > 0 ? bucket.count / maxMoment : 0;
            const radius = 2 + intensity * 3.5;
            const opacity = 0.4 + intensity * 0.55;
            return (
              <circle
                key={bucket.positionSec}
                cx={x}
                cy={SVG_H - 4}
                r={radius}
                fill="var(--artist-accent, rgba(255,255,255,0.7))"
                opacity={opacity}
              />
            );
          })}

          {/* Playhead активного трека — позиция/скраб */}
          {isThisTrack && duration > 0 && (
            <rect
              x={Math.min(SVG_W - 1.5, Math.max(0, progress * SVG_W - 0.75))}
              y={0}
              width={1.5}
              height={SVG_H}
              style={{ fill: 'var(--artist-accent, rgba(255,255,255,0.9))', opacity: scrub !== null ? 0.95 : 0.55 }}
            />
          )}
        </svg>

        {/* Тултип — время под курсором */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="absolute bottom-1 w-px h-full bg-[var(--artist-accent)] opacity-40"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          disabled={isThisTrack && isLoading}
          aria-label={isThisTrack && isPlaying ? 'Пауза' : 'Играть'}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 shrink-0"
          style={{
            background: 'var(--artist-accent)',
            color: 'var(--artist-bg, #0d0d0d)',
            boxShadow: '0 0 28px 2px color-mix(in oklch, var(--artist-accent) 30%, transparent)',
          }}
        >
          {isThisTrack && isLoading ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isThisTrack && isPlaying ? (
            <PauseIcon size={20} />
          ) : (
            <PlayIcon size={20} className="translate-x-[1px]" />
          )}
        </button>

        {/* Time */}
        {isThisTrack && (
          <span className="text-xs font-mono opacity-40 tabular-nums shrink-0">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        )}

        <div className="flex-1" />

        {/* Момент-маркер */}
        {isThisTrack && (
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            onClick={handleMarkMoment}
            title="Отметить любимый момент"
            aria-label="Отметить любимый момент"
            className="w-8 h-8 rounded-full flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity"
            style={{ border: '1px solid var(--artist-accent)' }}
          >
            <HeartIcon size={14} strokeWidth={2} />
          </motion.button>
        )}

        {/* Share с таймкодом — поповер: ссылка на трек или с момента */}
        <TrackShare
          currentTime={isThisTrack ? currentTime : undefined}
          size="sm"
          variant="bordered"
          align="right"
        />
      </div>
    </div>
  );
}

function buildBars(peaks: number[] | null): number[] {
  if (!peaks || peaks.length === 0) {
    return Array.from({ length: BAR_COUNT }, (_, i) =>
      0.3 + 0.4 * Math.abs(Math.sin(i * 0.4)),
    );
  }
  const step = peaks.length / BAR_COUNT;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const from = Math.floor(i * step);
    const to = Math.min(Math.ceil((i + 1) * step), peaks.length);
    const slice = peaks.slice(from, to);
    return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  });
}

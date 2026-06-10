'use client';

import { useEffect, useCallback, useRef, type MouseEvent } from 'react';
import { motion } from 'motion/react';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls, initAudioEngine } from '@/components/player/audio-engine';
import { TrackShare } from '@/components/track-share';
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

  const isThisTrack = currentTrackId === track.id;
  const progress = isThisTrack && duration > 0 ? currentTime / duration : 0;

  // Seek to ?t= param after track loads
  useEffect(() => {
    if (!seekTo || didSeek.current || !isThisTrack || duration <= 0) return;
    didSeek.current = true;
    controls.seek(Math.min(seekTo, duration - 1));
  }, [seekTo, isThisTrack, duration]);

  function handleWaveformClick(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;

    if (isThisTrack && duration) {
      controls.seek(frac * duration);
    } else {
      controls.play(track, queue, queueIndex);
    }
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
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="none"
          onClick={handleWaveformClick}
          aria-label={isThisTrack ? 'Прогресс воспроизведения' : 'Воспроизвести'}
          role={isThisTrack ? 'slider' : 'button'}
          aria-valuenow={isThisTrack ? Math.round(currentTime) : undefined}
          aria-valuemin={isThisTrack ? 0 : undefined}
          aria-valuemax={isThisTrack ? Math.round(duration) : undefined}
          className="w-full h-24 sm:h-28 cursor-pointer"
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
            <PauseIcon />
          ) : (
            <PlayIcon />
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
            <HeartPulseIcon />
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

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="translate-x-[1px]">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function HeartPulseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

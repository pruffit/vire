'use client';

import { useEffect, type MouseEvent } from 'react';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls, initAudioEngine } from '@/components/player/audio-engine';

const BAR_COUNT = 120;
const SVG_H = 80;
const BAR_W = 2;
const BAR_GAP = 1;
const SVG_W = BAR_COUNT * (BAR_W + BAR_GAP);

interface Props {
  track: PlayerTrack;
  queue: PlayerTrack[];
  queueIndex: number;
  peaks: number[] | null;
}

export function TrackWaveformPlayer({ track, queue, queueIndex, peaks }: Props) {
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

  function handleWaveformClick(e: MouseEvent<SVGSVGElement>) {
    if (isThisTrack && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      controls.seek(((e.clientX - rect.left) / rect.width) * duration);
    } else {
      controls.play(track, queue, queueIndex);
    }
  }

  function handlePlayPause() {
    if (isThisTrack) {
      controls.togglePlay();
    } else {
      controls.play(track, queue, queueIndex);
    }
  }

  const bars = buildBars(peaks);

  return (
    <div className="space-y-3">
      {/* Waveform */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        onClick={handleWaveformClick}
        aria-label={isThisTrack ? 'Прогресс воспроизведения' : 'Воспроизвести'}
        role={isThisTrack ? 'slider' : 'button'}
        aria-valuenow={isThisTrack ? Math.round(currentTime) : undefined}
        aria-valuemin={isThisTrack ? 0 : undefined}
        aria-valuemax={isThisTrack ? Math.round(duration) : undefined}
        className="w-full h-20 cursor-pointer"
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
      </svg>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          disabled={isThisTrack && isLoading}
          aria-label={isThisTrack && isPlaying ? 'Пауза' : 'Играть'}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity disabled:opacity-40"
          style={{ background: 'var(--artist-accent)', color: 'var(--artist-bg, #0d0d0d)' }}
        >
          {isThisTrack && isLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isThisTrack && isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        {isThisTrack && (
          <span className="text-xs font-mono opacity-40 tabular-nums">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>
        )}
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

function fmtTime(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

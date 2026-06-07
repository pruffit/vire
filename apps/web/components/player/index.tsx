'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls, initAudioEngine } from './audio-engine';
import { formatDuration } from '@/lib/format';

export function Player() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    initAudioEngine();
  }, []);

  const track = usePlayerStore((s) => s.track);
  if (!track) return null;

  return (
    <>
      <div className="shrink-0 h-16 bg-card border-t border-border flex items-center px-4 gap-4">
        <TrackInfo onExpandCover={() => setExpanded(true)} />
        <Controls />
        <ProgressSection />
      </div>
      {expanded && <FullscreenPlayer onClose={() => setExpanded(false)} />}
    </>
  );
}

/** Имя артиста → страница артиста, название → страница релиза. Если слаг/releaseId
 *  не известны источнику, показываем простой текст без ссылки. */
function ArtistLink({ track, className }: { track: PlayerTrack; className?: string }) {
  if (!track.artistSlug) return <span className={className}>{track.artistName}</span>;
  return (
    <Link href={`/artists/${track.artistSlug}`} className={`${className ?? ''} hover:underline`}>
      {track.artistName}
    </Link>
  );
}

function TitleLink({ track, className }: { track: PlayerTrack; className?: string }) {
  if (!track.artistSlug || !track.releaseId) return <span className={className}>{track.title}</span>;
  return (
    <Link
      href={`/artists/${track.artistSlug}/releases/${track.releaseId}`}
      className={`${className ?? ''} hover:underline`}
    >
      {track.title}
    </Link>
  );
}

function TrackInfo({ onExpandCover }: { onExpandCover: () => void }) {
  const track = usePlayerStore((s) => s.track);
  if (!track) return null;

  return (
    <div className="flex items-center gap-3 w-1/3 min-w-0">
      <button
        onClick={onExpandCover}
        aria-label="Открыть плеер на весь экран"
        className="w-10 h-10 rounded-sm shrink-0 overflow-hidden relative group"
      >
        {track.coverUrl ? (
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/5" />
        )}
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ExpandIcon />
        </span>
      </button>
      <div className="min-w-0 hidden sm:block">
        <TitleLink track={track} className="text-sm font-medium truncate leading-tight block" />
        <ArtistLink track={track} className="text-xs text-muted-foreground truncate block" />
      </div>
    </div>
  );
}

function FullscreenPlayer({ onClose }: { onClose: () => void }) {
  const track = usePlayerStore((s) => s.track);

  // Esc закрывает полноэкранный режим
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!track) return null;

  return (
    <div className="fixed inset-0 z-50 bg-card/95 backdrop-blur-xl flex flex-col items-center justify-center px-6 py-12">
      <button
        onClick={onClose}
        aria-label="Свернуть плеер"
        className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
      >
        <ChevronDownIcon />
      </button>

      <div className="w-full max-w-md flex flex-col items-center gap-8">
        {/* Большая обложка */}
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-64 h-64 sm:w-80 sm:h-80 rounded-lg object-cover shadow-2xl"
          />
        ) : (
          <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-lg bg-white/5" />
        )}

        {/* Название + артист */}
        <div className="text-center min-w-0 w-full" onClick={onClose}>
          <TitleLink track={track} className="text-xl font-semibold truncate block" />
          <ArtistLink track={track} className="text-sm text-muted-foreground truncate block mt-1" />
        </div>

        {/* Прогресс */}
        <div className="w-full flex items-center gap-3">
          <TimeLabel which="current" />
          <Waveform />
          <TimeLabel which="duration" />
        </div>

        {/* Управление */}
        <Controls />
      </div>
    </div>
  );
}

function TimeLabel({ which }: { which: 'current' | 'duration' }) {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  return (
    <span className="text-xs font-mono text-muted-foreground tabular-nums w-9 text-center shrink-0">
      {formatDuration(which === 'current' ? currentTime : duration)}
    </span>
  );
}

function Controls() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const hasAudio = usePlayerStore((s) => s.hasAudio);

  return (
    <div className="flex items-center gap-5 justify-center flex-1">
      <button
        onClick={() => controls.prev()}
        aria-label="Предыдущий трек"
        className="opacity-50 hover:opacity-100 transition-opacity"
      >
        <SkipBackIcon />
      </button>

      <button
        onClick={() => controls.togglePlay()}
        disabled={!hasAudio || isLoading}
        aria-label={isPlaying ? 'Пауза' : 'Играть'}
        className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:bg-primary/90 transition-colors"
      >
        {isLoading ? (
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <PauseIcon />
        ) : (
          <PlayIcon />
        )}
      </button>

      <button
        onClick={() => controls.next()}
        aria-label="Следующий трек"
        className="opacity-50 hover:opacity-100 transition-opacity"
      >
        <SkipForwardIcon />
      </button>
    </div>
  );
}

function ProgressSection() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);

  return (
    <div className="hidden sm:flex items-center gap-2 w-1/3 justify-end">
      <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right">
        {formatDuration(currentTime)}
      </span>

      <Waveform />

      <span className="text-xs font-mono text-muted-foreground tabular-nums w-8">
        {formatDuration(duration)}
      </span>

      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={volume}
        onChange={(e) => controls.setVolume(Number(e.target.value))}
        aria-label="Громкость"
        className="w-16 h-1 accent-primary cursor-pointer hidden lg:block"
      />
    </div>
  );
}

function Waveform() {
  const peaks = usePlayerStore((s) => s.waveformPeaks);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  const progress = duration > 0 ? currentTime / duration : 0;

  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    controls.seek(((e.clientX - rect.left) / rect.width) * duration);
  }

  if (!peaks || peaks.length === 0) {
    return (
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        step={0.5}
        onChange={(e) => controls.seek(Number(e.target.value))}
        aria-label="Прогресс"
        className="flex-1 h-1 accent-primary cursor-pointer"
      />
    );
  }

  const BAR_COUNT = 80;
  const step = peaks.length / BAR_COUNT;
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const from = Math.floor(i * step);
    const to = Math.min(Math.ceil((i + 1) * step), peaks.length);
    const slice = peaks.slice(from, to);
    return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  });

  const SVG_H = 24;
  const BAR_W = 2;
  const BAR_GAP = 1;
  const SVG_W = BAR_COUNT * (BAR_W + BAR_GAP);

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      onClick={handleClick}
      aria-label="Прогресс"
      role="slider"
      aria-valuenow={Math.round(currentTime)}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      className="flex-1 h-6 cursor-pointer"
    >
      {bars.map((peak, i) => {
        const h = Math.max(2, peak * (SVG_H - 4));
        const x = i * (BAR_W + BAR_GAP);
        const played = i / BAR_COUNT < progress;
        return (
          <rect
            key={i}
            x={x}
            y={(SVG_H - h) / 2}
            width={BAR_W}
            height={h}
            rx={0.5}
            fill={played ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.18)'}
          />
        );
      })}
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="3" width="4" height="18" rx="1" />
      <rect x="15" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="19,20 9,12 19,4" />
      <rect x="5" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,4 15,12 5,20" />
      <rect x="17" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}

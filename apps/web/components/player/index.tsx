'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/store/player';
import { controls, initAudioEngine } from './audio-engine';

export function Player() {
  useEffect(() => {
    initAudioEngine();
  }, []);

  const track = usePlayerStore((s) => s.track);
  if (!track) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 h-16 bg-card border-t border-border flex items-center px-4 gap-4">
      <TrackInfo />
      <Controls />
      <ProgressSection />
    </div>
  );
}

function TrackInfo() {
  const track = usePlayerStore((s) => s.track);
  if (!track) return null;

  return (
    <div className="flex items-center gap-3 w-1/3 min-w-0">
      {track.coverUrl ? (
        <img
          src={track.coverUrl}
          alt={track.title}
          className="w-10 h-10 rounded-sm shrink-0 object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-sm bg-white/5 shrink-0" />
      )}
      <div className="min-w-0 hidden sm:block">
        <p className="text-sm font-medium truncate leading-tight">{track.title}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
      </div>
    </div>
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
        {fmt(currentTime)}
      </span>

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

      <span className="text-xs font-mono text-muted-foreground tabular-nums w-8">
        {fmt(duration)}
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

function fmt(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReduceMotionPref } from '@vire/ui/motion';
import { fetchManifest } from '@/lib/player/manifest-cache';
import { createScene, parseAccent, VISUALIZER_PRESETS, type Scene, type VisualizerPreset } from './presets';

export { VISUALIZER_PRESETS, type VisualizerPreset } from './presets';

const STORAGE_KEY = 'vire-visualizer';
const MAX_DPR = 1.5;
const AMP_SMOOTHING = 0.16;

function isPreset(value: string | null): value is VisualizerPreset {
  return VISUALIZER_PRESETS.some((p) => p.value === value);
}

function readPreset(): VisualizerPreset {
  if (typeof window === 'undefined') return 'off';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPreset(stored) ? stored : 'off';
  } catch {
    return 'off';
  }
}

/** Экран вечеринки рисуется только после клика — SSR его не отдаёт, читать хранилище на первом рендере безопасно. */
export function useVisualizerPreset(): [VisualizerPreset, (next: VisualizerPreset) => void] {
  const [preset, setPreset] = useState<VisualizerPreset>(readPreset);

  const update = useCallback((next: VisualizerPreset) => {
    setPreset(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // приватный режим/заблокированное хранилище — выбор просто не переживёт перезагрузку
    }
  }, []);

  return [preset, update];
}

interface Props {
  preset: VisualizerPreset;
  accentColor?: string | null;
  /** Позиция каталога — амплитуду берём из готовых waveform-пиков трека. */
  trackId?: string | null;
  playing: boolean;
  positionSec: number;
  durationSec?: number | null;
  className?: string;
}

export function Visualizer({ preset, accentColor, trackId, playing, positionSec, durationSec, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<number[] | null>(null);
  const sceneRef = useRef<{ preset: VisualizerPreset; scene: Scene } | null>(null);
  const positionRef = useRef({ sec: positionSec, at: 0 });
  const playingRef = useRef(playing);
  const durationRef = useRef(durationSec ?? null);
  const accentRef = useRef(parseAccent(accentColor));
  const reduceMotion = useReduceMotionPref();

  useEffect(() => {
    positionRef.current = { sec: positionSec, at: performance.now() };
    playingRef.current = playing;
    durationRef.current = durationSec ?? null;
    accentRef.current = parseAccent(accentColor);
  });

  useEffect(() => {
    peaksRef.current = null;
    if (!trackId) return;
    let cancelled = false;
    void fetchManifest(trackId).then((manifest) => {
      if (!cancelled) peaksRef.current = manifest?.waveformPeaks ?? null;
    });
    return () => { cancelled = true; };
  }, [trackId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (preset === 'off' || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (sceneRef.current?.preset !== preset) sceneRef.current = { preset, scene: createScene(preset) };
    const scene = sceneRef.current.scene;

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    let width = 1;
    let height = 1;
    let amp = 0.35;
    let frame = 0;
    const startedAt = performance.now();

    function resize(): void {
      const rect = canvas!.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function targetAmp(seconds: number): number {
      const peaks = peaksRef.current;
      const duration = durationRef.current;
      if (peaks && peaks.length > 0 && duration && duration > 0) {
        const { sec, at } = positionRef.current;
        const drift = playingRef.current ? (performance.now() - at) / 1000 : 0;
        const ratio = Math.min(1, Math.max(0, (sec + drift) / duration));
        const peak = peaks[Math.min(peaks.length - 1, Math.floor(ratio * peaks.length))] ?? 0;
        return Math.min(1, peak * 1.7);
      }
      // Без пиков (YouTube/SoundCloud/файл) — процедурная огибающая: дыхание плюс редкие всплески.
      return Math.min(1, 0.34 + 0.2 * Math.sin(seconds * 1.6) + 0.3 * Math.pow(Math.abs(Math.sin(seconds * 1.05)), 6));
    }

    function render(): void {
      const seconds = (performance.now() - startedAt) / 1000;
      amp += (targetAmp(seconds) - amp) * AMP_SMOOTHING;
      scene.draw(ctx!, { width, height, time: seconds, amp, accent: accentRef.current });
    }

    function loop(): void {
      render();
      frame = requestAnimationFrame(loop);
    }

    function sync(): void {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (reduceMotion || !playing || document.hidden) {
        render();
        return;
      }
      frame = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(() => { resize(); render(); });
    observer.observe(canvas);
    resize();
    sync();
    document.addEventListener('visibilitychange', sync);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [preset, reduceMotion, playing]);

  if (preset === 'off') return null;

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}

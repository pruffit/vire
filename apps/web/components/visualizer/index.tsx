'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useReduceMotionPref } from '@vire/ui/motion';
import { fetchManifest } from '@/lib/player/manifest-cache';
import { createFeatureReader, type FeatureReader } from '@/lib/visualizer/analyser';
import { getVisualizerTap, onVisualizerTapChange } from '@/lib/visualizer/audio-tap';
import { loadCoverPalette } from '@/lib/visualizer/palette';
import { createVisualizerEngine } from './engine';
import { parseAccent, type Rgb } from './scenes';

const STORAGE_KEY = 'vire-visualizer';
const MAX_DPR = 1.5;
const AMP_SMOOTHING = 0.16;
/** Живой звук уже сглажен анализатором — второй раз тормозить картинку незачем. */
const REACTIVE_SMOOTHING = 0.4;

function readEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

/** Экран вечеринки рисуется только после клика — SSR его не отдаёт, читать хранилище на первом рендере безопасно. */
export function useVisualizerEnabled(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState(readEnabled);

  const update = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      // приватный режим/заблокированное хранилище — выбор просто не переживёт перезагрузку
    }
  }, []);

  return [enabled, update];
}

interface Props {
  enabled: boolean;
  accentColor?: string | null;
  /** Обложка текущего трека — из неё берётся палитра сцены. */
  coverUrl?: string | null;
  /** Позиция каталога — амплитуду берём из готовых waveform-пиков трека. */
  trackId?: string | null;
  playing: boolean;
  positionSec: number;
  durationSec?: number | null;
  className?: string;
}

export function Visualizer({ enabled, accentColor, coverUrl, trackId, playing, positionSec, durationSec, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<number[] | null>(null);
  const positionRef = useRef({ sec: positionSec, at: 0 });
  const playingRef = useRef(playing);
  const durationRef = useRef(durationSec ?? null);
  const accentRef = useRef(parseAccent(accentColor));
  const reduceMotion = useReduceMotionPref();
  const tap = useSyncExternalStore(onVisualizerTapChange, getVisualizerTap, () => null);
  const readerRef = useRef<FeatureReader | null>(null);
  const paletteRef = useRef<Rgb[]>([]);

  useEffect(() => {
    paletteRef.current = [];
    if (!coverUrl) return;
    let cancelled = false;
    void loadCoverPalette(coverUrl).then((colors) => {
      if (!cancelled) paletteRef.current = colors;
    });
    return () => { cancelled = true; };
  }, [coverUrl]);

  useEffect(() => {
    readerRef.current = createFeatureReader(tap);
    return () => {
      readerRef.current?.dispose();
      readerRef.current = null;
    };
  }, [tap]);

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
    if (!enabled || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const engine = createVisualizerEngine();
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
      const live = readerRef.current?.read(seconds) ?? null;
      amp += ((live ? live.level : targetAmp(seconds)) - amp) * (live ? REACTIVE_SMOOTHING : AMP_SMOOTHING);
      // Без живого звука полос нет — раскладываем ту же огибающую, чтобы сцены не застыли.
      const bass = live ? live.bass : amp * 0.8;
      const treble = live ? live.treble : amp * 0.45;
      const beat = live ? live.beat : 0;
      engine.draw(
        ctx!,
        { width, height, time: seconds, amp, bass, treble, beat, accent: accentRef.current, palette: paletteRef.current },
        dpr,
      );
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
      engine.dispose();
    };
  }, [enabled, reduceMotion, playing]);

  if (!enabled) return null;

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}

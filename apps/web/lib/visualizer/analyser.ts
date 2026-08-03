import type { VisualizerTap } from './audio-tap';
import { bandEnergy, createBeatTracker, decayBeat, rms, SILENT_FEATURES, type AudioFeatures } from './features';

const FFT_SIZE = 1024;
const SMOOTHING = 0.72;

export interface FeatureReader {
  read(timeSec: number): AudioFeatures;
  dispose(): void;
}

let context: AudioContext | null = null;
/** Второй `createMediaElementSource` на том же элементе кидает InvalidStateError — узел живёт вечно. */
const elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

function audioContext(): AudioContext | null {
  if (context) return context;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

function connectElement(ctx: AudioContext, el: HTMLMediaElement, analyser: AnalyserNode): void {
  let source = elementSources.get(el);
  if (!source) {
    source = ctx.createMediaElementSource(el);
    elementSources.set(el, source);
  }
  // Обязательно: после createMediaElementSource звук идёт ТОЛЬКО через граф.
  source.connect(ctx.destination);
  source.connect(analyser);
}

/** Поток захвата в динамики не выводим — это был бы второй экземпляр того же звука. */
export function createFeatureReader(tap: VisualizerTap): FeatureReader | null {
  if (!tap) return null;
  const ctx = audioContext();
  if (!ctx) return null;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = SMOOTHING;

  try {
    if (tap.kind === 'element') connectElement(ctx, tap.element, analyser);
    else ctx.createMediaStreamSource(tap.stream).connect(analyser);
  } catch {
    return null;
  }

  void ctx.resume().catch(() => {});

  const freq = new Uint8Array(analyser.frequencyBinCount);
  const wave = new Uint8Array(analyser.fftSize);
  const beats = createBeatTracker();
  let beat = 0;
  let lastAt = 0;

  return {
    read(timeSec) {
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(wave);

      const bass = bandEnergy(freq, 0, 0.08);
      const mid = bandEnergy(freq, 0.08, 0.35);
      const treble = bandEnergy(freq, 0.35, 1);

      const delta = lastAt === 0 ? 0 : Math.max(0, timeSec - lastAt);
      lastAt = timeSec;
      beat = decayBeat(beat, delta);
      if (beats.push(bass, timeSec)) beat = 1;

      return { level: rms(wave), bass, mid, treble, beat, bpm: beats.bpm() };
    },

    dispose() {
      analyser.disconnect();
    },
  };
}

export { SILENT_FEATURES };

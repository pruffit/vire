import type HlsType from 'hls.js';
import { fetchManifest } from '@/lib/player/manifest-cache';
import { HLS_TUNING, attachStallRecovery } from '@/lib/player/hls-runtime';

interface VendorPitchAudioElement extends HTMLAudioElement {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
}

export interface JamAudioEngine {
  load(trackId: string): Promise<void>;
  play(): void;
  pause(): void;
  seek(ms: number): void;
  setRate(rate: number): void;
  currentTimeMs(): number;
  /** Элемент реально ждёт данные (событие `waiting` без последующего `playing`) — дрейф на этом недостоверен. */
  isBuffering(): boolean;
  onEnded(listener: () => void): () => void;
  destroy(): void;
}

async function loadHlsClass(): Promise<typeof HlsType> {
  return (await import('hls.js')).default;
}

export function createJamAudio(): JamAudioEngine {
  const audio = new Audio() as VendorPitchAudioElement;
  // Дрейф корректируется playbackRate — без этого держатся вендорные варианты Firefox/Safari.
  audio.preservesPitch = true;
  audio.mozPreservesPitch = true;
  audio.webkitPreservesPitch = true;

  let hls: HlsType | null = null;
  let loadedTrackId: string | null = null;
  let pendingLoadResolve: (() => void) | null = null;
  let buffering = false;
  const endedListeners = new Set<() => void>();

  const handleEnded = (): void => endedListeners.forEach((listener) => listener());
  const handleWaiting = (): void => { buffering = true; };
  const handlePlaying = (): void => { buffering = false; };
  audio.addEventListener('ended', handleEnded);
  audio.addEventListener('waiting', handleWaiting);
  audio.addEventListener('playing', handlePlaying);

  function destroyHls(): void {
    if (!hls) return;
    hls.destroy();
    hls = null;
  }

  function resolvePendingLoad(): void {
    const resolve = pendingLoadResolve;
    pendingLoadResolve = null;
    resolve?.();
  }

  return {
    async load(trackId) {
      loadedTrackId = trackId;
      resolvePendingLoad();
      destroyHls();

      const manifest = await fetchManifest(trackId).catch(() => null);
      // Staleness guard: пока ждали сеть, load() мог быть вызван для другого трека.
      if (loadedTrackId !== trackId) return;
      if (!manifest) return;

      const Hls = await loadHlsClass();
      if (loadedTrackId !== trackId) return;

      if (Hls.isSupported()) {
        const instance = new Hls(HLS_TUNING);
        hls = instance;
        instance.on(Hls.Events.MANIFEST_PARSED, resolvePendingLoad);
        instance.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) {
            const benign = data.details === 'bufferSeekOverHole' || data.details === 'bufferNudgeOnStall';
            if (!benign) console.warn('[jam] HLS error', data.type, data.details);
            return;
          }
          destroyHls();
          resolvePendingLoad();
        });
        attachStallRecovery(instance, audio, Hls);
        await new Promise<void>((resolve) => {
          pendingLoadResolve = resolve;
          instance.loadSource(manifest.hlsUrl);
          instance.attachMedia(audio);
        });
      } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        audio.src = manifest.hlsUrl;
      }
    },

    play(): void {
      audio.play().catch(() => {});
    },

    pause(): void {
      audio.pause();
    },

    seek(ms: number): void {
      audio.currentTime = ms / 1000;
    },

    setRate(rate: number): void {
      audio.playbackRate = rate;
    },

    currentTimeMs(): number {
      return audio.currentTime * 1000;
    },

    isBuffering(): boolean {
      return buffering;
    },

    onEnded(listener: () => void): () => void {
      endedListeners.add(listener);
      return () => endedListeners.delete(listener);
    },

    destroy(): void {
      resolvePendingLoad();
      destroyHls();
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.pause();
      audio.removeAttribute('src');
      audio.src = '';
      audio.load();
      endedListeners.clear();
      loadedTrackId = null;
    },
  };
}

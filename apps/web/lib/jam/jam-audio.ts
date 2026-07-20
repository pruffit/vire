import type HlsType from 'hls.js';
import { fetchManifest } from '@/lib/player/manifest-cache';

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
  const endedListeners = new Set<() => void>();

  const handleEnded = (): void => endedListeners.forEach((listener) => listener());
  audio.addEventListener('ended', handleEnded);

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
        const instance = new Hls();
        hls = instance;
        instance.on(Hls.Events.MANIFEST_PARSED, resolvePendingLoad);
        instance.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;
          destroyHls();
          resolvePendingLoad();
        });
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

    onEnded(listener: () => void): () => void {
      endedListeners.add(listener);
      return () => endedListeners.delete(listener);
    },

    destroy(): void {
      resolvePendingLoad();
      destroyHls();
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.removeAttribute('src');
      audio.src = '';
      audio.load();
      endedListeners.clear();
      loadedTrackId = null;
    },
  };
}

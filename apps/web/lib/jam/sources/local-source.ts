import { getLocalFile } from '@/lib/party/local-files';
import { usePlayerStore } from '@/store/player';
import type { JamSourceEngine } from '../jam-audio';

/** Локальный файл с устройства-колонки: обычный `<audio>` поверх `URL.createObjectURL`. Неизвестный id (файл лежит на чужом устройстве) — молчаливый простой, без throw. */
export function createLocalSource(): JamSourceEngine {
  const audio = new Audio();
  audio.volume = usePlayerStore.getState().volume;
  const unsubscribeVolume = usePlayerStore.subscribe((state, prevState) => {
    if (state.volume !== prevState.volume) audio.volume = state.volume;
  });

  let buffering = false;
  let objectUrl: string | null = null;
  let settlePendingLoad: (() => void) | null = null;
  const endedListeners = new Set<() => void>();
  const playingListeners = new Set<() => void>();

  const handleEnded = (): void => endedListeners.forEach((l) => l());
  const handleWaiting = (): void => { buffering = true; };
  const handlePlaying = (): void => {
    buffering = false;
    playingListeners.forEach((l) => l());
  };
  audio.addEventListener('ended', handleEnded);
  audio.addEventListener('waiting', handleWaiting);
  audio.addEventListener('playing', handlePlaying);

  function releaseUrl(): void {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  return {
    load(fileId): Promise<void> {
      settlePendingLoad?.();
      releaseUrl();
      const file = getLocalFile(fileId);
      if (!file) {
        audio.removeAttribute('src');
        audio.load();
        return Promise.resolve();
      }
      objectUrl = URL.createObjectURL(file);
      audio.src = objectUrl;
      audio.load();
      return new Promise((resolve) => {
        const done = () => {
          audio.removeEventListener('loadedmetadata', done);
          audio.removeEventListener('error', done);
          settlePendingLoad = null;
          resolve();
        };
        settlePendingLoad = done;
        audio.addEventListener('loadedmetadata', done);
        audio.addEventListener('error', done);
      });
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

    onPlaying(listener: () => void): () => void {
      playingListeners.add(listener);
      return () => playingListeners.delete(listener);
    },

    destroy(): void {
      settlePendingLoad?.();
      releaseUrl();
      unsubscribeVolume();
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.pause();
      audio.removeAttribute('src');
      audio.src = '';
      audio.load();
      endedListeners.clear();
      playingListeners.clear();
    },
  };
}

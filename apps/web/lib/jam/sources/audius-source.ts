import { audiusStreamUrl } from '@/lib/external/audius';
import { usePlayerStore } from '@/store/player';
import type { JamSourceEngine } from '../jam-audio';

/**
 * Audius — прямой аудиопоток по официальному API, без iframe и без видео-поверхности.
 * Значит колонкой может быть любое устройство, даже когда экран вечеринки не открыт.
 */
export function createAudiusSource(): JamSourceEngine {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.volume = usePlayerStore.getState().volume;

  const unsubscribeVolume = usePlayerStore.subscribe((state, prevState) => {
    if (state.volume !== prevState.volume) audio.volume = state.volume;
  });

  let buffering = false;
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

  return {
    load(trackId): Promise<void> {
      audio.src = audiusStreamUrl(trackId);
      audio.load();
      return Promise.resolve();
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

    // Своего плеера у пользователя тут нет — переключать нечего.
    onUserToggle(): () => void {
      return () => {};
    },

    destroy(): void {
      unsubscribeVolume();
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      endedListeners.clear();
      playingListeners.clear();
    },
  };
}

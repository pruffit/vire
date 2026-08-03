import { usePlayerStore } from '@/store/player';
import type { JamSourceEngine } from '../jam-audio';
import { createVideoMount, getPartyVideoContainer, onPartyVideoContainerChange } from './video-container';

// Минимальный срез типов YT.Player, который реально используется — полный @types/youtube не тянем.
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  loadVideoById(videoId: string): void;
  setVolume(volume: number): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}
interface YTPlayerEvent { target: YTPlayer; data?: number }
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (e: YTPlayerEvent) => void;
        onStateChange?: (e: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number };
}
type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

let apiPromise: Promise<YTNamespace> | null = null;

/** Грузит IFrame API-скрипт лениво и один раз на всю сессию вкладки. */
function loadYoutubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const w = window as YTWindow;
    if (w.YT?.Player) {
      resolve(w.YT);
      return;
    }
    const previousReady = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(w.YT!);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

export function createYoutubeSource(): JamSourceEngine {
  let player: YTPlayer | null = null;
  let host: HTMLElement | null = null;
  let pendingVideoId: string | null = null;
  let buffering = false;
  let pendingLoadResolve: (() => void) | null = null;
  // Поверхность может появиться уже после старта позиции (открыли экран/панель на ходу) —
  // тогда свежесозданный плеер обязан догнать намерение, а не встать на нуле в паузе.
  let desiredPositionMs: number | null = null;
  let shouldPlay = false;
  const endedListeners = new Set<() => void>();
  const playingListeners = new Set<() => void>();
  const userToggleListeners = new Set<(playing: boolean) => void>();

  const unsubscribeVolume = usePlayerStore.subscribe((state, prevState) => {
    if (state.volume !== prevState.volume) player?.setVolume(state.volume * 100);
  });

  function resolvePendingLoad(): void {
    const resolve = pendingLoadResolve;
    pendingLoadResolve = null;
    resolve?.();
  }

  function destroyPlayer(): void {
    player?.destroy();
    player = null;
    host?.remove();
    host = null;
  }

  async function attach(parent: HTMLElement, videoId: string): Promise<void> {
    const YT = await loadYoutubeApi();
    // Контейнер/видео могли смениться, пока грузился скрипт API.
    if (pendingVideoId !== videoId || getPartyVideoContainer() !== parent) return;

    const mounted = createVideoMount();
    if (!mounted) return;
    host = mounted.host;

    player = new YT.Player(mounted.mount, {
      videoId,
      playerVars: { playsinline: 1 },
      events: {
        onReady: (e) => {
          e.target.setVolume(usePlayerStore.getState().volume * 100);
          // Iframe API размещает плеер фиксированным 640×390 — растягиваем на весь контейнер вечеринки.
          const iframe = e.target.getIframe();
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          if (desiredPositionMs !== null) e.target.seekTo(desiredPositionMs / 1000, true);
          if (shouldPlay) e.target.playVideo();
          resolvePendingLoad();
        },
        onStateChange: (e) => {
          const state = e.data;
          if (state === YT.PlayerState.BUFFERING) buffering = true;
          if (state === YT.PlayerState.PLAYING) {
            buffering = false;
            playingListeners.forEach((l) => l());
            // Играет, хотя мы не просили — значит нажали play в самом плеере YouTube.
            if (!shouldPlay) {
              shouldPlay = true;
              userToggleListeners.forEach((l) => l(true));
            }
          }
          if (state === YT.PlayerState.PAUSED && shouldPlay) {
            shouldPlay = false;
            userToggleListeners.forEach((l) => l(false));
          }
          if (state === YT.PlayerState.ENDED) endedListeners.forEach((l) => l());
        },
      },
    });
  }

  const unsubscribeContainer = onPartyVideoContainerChange((el) => {
    if (!pendingVideoId) return;
    destroyPlayer();
    if (el) void attach(el, pendingVideoId);
  });

  return {
    load(videoId): Promise<void> {
      pendingVideoId = videoId;
      desiredPositionMs = null;
      resolvePendingLoad();

      const el = getPartyVideoContainer();
      if (!el) return Promise.resolve(); // нет экрана вечеринки на этом устройстве — источник недоступен

      if (player) {
        player.loadVideoById(videoId);
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        pendingLoadResolve = resolve;
        void attach(el, videoId);
      });
    },

    play(): void {
      shouldPlay = true;
      player?.playVideo();
    },

    pause(): void {
      shouldPlay = false;
      player?.pauseVideo();
    },

    seek(ms: number): void {
      desiredPositionMs = ms;
      player?.seekTo(ms / 1000, true);
    },

    currentTimeMs(): number {
      return (player?.getCurrentTime() ?? 0) * 1000;
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

    onUserToggle(listener: (playing: boolean) => void): () => void {
      userToggleListeners.add(listener);
      return () => userToggleListeners.delete(listener);
    },

    destroy(): void {
      resolvePendingLoad();
      unsubscribeContainer();
      unsubscribeVolume();
      destroyPlayer();
      endedListeners.clear();
      playingListeners.clear();
      userToggleListeners.clear();
      pendingVideoId = null;
      desiredPositionMs = null;
      shouldPlay = false;
    },
  };
}

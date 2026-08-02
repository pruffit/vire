import { usePlayerStore } from '@/store/player';
import type { JamSourceEngine } from '../jam-audio';
import { createVideoMount, getPartyVideoContainer, onPartyVideoContainerChange } from './video-container';

const API_SRC = 'https://w.soundcloud.com/player/api.js';

// Минимальный срез SC.Widget — полного пакета типов у SoundCloud нет.
interface SCWidget {
  bind(event: string, listener: (e?: { currentPosition?: number }) => void): void;
  unbind(event: string): void;
  play(): void;
  pause(): void;
  seekTo(ms: number): void;
  setVolume(volume: number): void;
  load(url: string, opts: { auto_play: boolean; callback?: () => void }): void;
}
interface SCNamespace {
  Widget: ((el: HTMLIFrameElement) => SCWidget) & {
    Events: { READY: string; PLAY: string; PAUSE: string; FINISH: string; PLAY_PROGRESS: string; ERROR: string };
  };
}
type SCWindow = Window & { SC?: SCNamespace };

let apiPromise: Promise<SCNamespace | null> | null = null;

/** Грузит Widget API лениво и один раз на вкладку; сбой скрипта (блокировщик, офлайн) — null, источник просто простаивает. */
function loadWidgetApi(): Promise<SCNamespace | null> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const w = window as SCWindow;
    if (w.SC?.Widget) {
      resolve(w.SC);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${API_SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve((window as SCWindow).SC ?? null), { once: true });
    script.addEventListener('error', () => resolve(null), { once: true });
    if (!existing) {
      script.src = API_SRC;
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

function embedUrl(trackUrl: string): string {
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=false&show_teaser=false`;
}

export function createSoundcloudSource(): JamSourceEngine {
  let widget: SCWidget | null = null;
  let host: HTMLElement | null = null;
  let pendingUrl: string | null = null;
  let positionMs = 0;
  let buffering = false;
  let pendingLoadResolve: (() => void) | null = null;
  const endedListeners = new Set<() => void>();
  const playingListeners = new Set<() => void>();

  const unsubscribeVolume = usePlayerStore.subscribe((state, prevState) => {
    if (state.volume !== prevState.volume) widget?.setVolume(state.volume * 100);
  });

  function resolvePendingLoad(): void {
    const resolve = pendingLoadResolve;
    pendingLoadResolve = null;
    resolve?.();
  }

  function destroyWidget(): void {
    widget = null;
    host?.remove();
    host = null;
    positionMs = 0;
  }

  async function attach(parent: HTMLElement, trackUrl: string): Promise<void> {
    const SC = await loadWidgetApi();
    // Контейнер/трек могли смениться, пока грузился скрипт API.
    if (!SC || pendingUrl !== trackUrl || getPartyVideoContainer() !== parent) {
      resolvePendingLoad();
      return;
    }

    const mounted = createVideoMount();
    if (!mounted) {
      resolvePendingLoad();
      return;
    }
    host = mounted.host;

    const iframe = document.createElement('iframe');
    iframe.src = embedUrl(trackUrl);
    iframe.allow = 'autoplay';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    mounted.mount.replaceWith(iframe);

    const w = SC.Widget(iframe);
    widget = w;
    const { READY, PLAY, PAUSE, FINISH, PLAY_PROGRESS, ERROR } = SC.Widget.Events;
    w.bind(READY, () => {
      w.setVolume(usePlayerStore.getState().volume * 100);
      resolvePendingLoad();
    });
    w.bind(ERROR, () => resolvePendingLoad());
    w.bind(PLAY, () => { buffering = true; });
    w.bind(PAUSE, () => { buffering = false; });
    w.bind(PLAY_PROGRESS, (e) => {
      const wasBuffering = buffering;
      buffering = false;
      positionMs = e?.currentPosition ?? positionMs;
      if (wasBuffering) playingListeners.forEach((l) => l());
    });
    w.bind(FINISH, () => endedListeners.forEach((l) => l()));
  }

  const unsubscribeContainer = onPartyVideoContainerChange((el) => {
    if (!pendingUrl) return;
    destroyWidget();
    if (el) void attach(el, pendingUrl);
  });

  return {
    load(trackUrl): Promise<void> {
      pendingUrl = trackUrl;
      resolvePendingLoad();
      positionMs = 0;

      const el = getPartyVideoContainer();
      if (!el) return Promise.resolve(); // нет экрана вечеринки на этом устройстве — источник недоступен

      if (widget) {
        return new Promise((resolve) => {
          widget!.load(trackUrl, { auto_play: false, callback: resolve });
        });
      }

      return new Promise((resolve) => {
        pendingLoadResolve = resolve;
        void attach(el, trackUrl);
      });
    },

    play(): void {
      widget?.play();
    },

    pause(): void {
      widget?.pause();
    },

    seek(ms: number): void {
      positionMs = ms;
      widget?.seekTo(ms);
    },

    /** Позиция приходит событием PLAY_PROGRESS — `getPosition` у виджета асинхронный, а контракт движка синхронный. */
    currentTimeMs(): number {
      return positionMs;
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
      resolvePendingLoad();
      unsubscribeContainer();
      unsubscribeVolume();
      destroyWidget();
      endedListeners.clear();
      playingListeners.clear();
      pendingUrl = null;
    },
  };
}

import { createVireSource } from './sources/vire-source';
import { createYoutubeSource } from './sources/youtube-source';
import { createSoundcloudSource } from './sources/soundcloud-source';
import { createLocalSource } from './sources/local-source';
import { createAudiusSource } from './sources/audius-source';

export type PlayableSource =
  | { kind: 'VIRE'; trackId: string }
  | { kind: 'YOUTUBE'; videoId: string }
  | { kind: 'SOUNDCLOUD'; url: string }
  | { kind: 'AUDIUS'; trackId: string }
  | { kind: 'LOCAL'; fileId: string };

export interface JamAudioEngine {
  load(source: PlayableSource): Promise<void>;
  play(): void;
  pause(): void;
  seek(ms: number): void;
  currentTimeMs(): number;
  /** Элемент реально ждёт данные (событие `waiting` без последующего `playing`) — дрейф на этом недостоверен. */
  isBuffering(): boolean;
  onEnded(listener: () => void): () => void;
  /** Звук фактически пошёл (событие `playing`) — момент, когда позицию можно точно ресинкнуть после буферизации. */
  onPlaying(listener: () => void): () => void;
  /** Пользователь нажал play/pause внутри встроенного плеера — джем обязан пойти за ним, иначе состояния разъезжаются. */
  onUserToggle(listener: (playing: boolean) => void): () => void;
  destroy(): void;
}

/** Контракт одного источника звука — тот же набор методов, что `JamAudioEngine`, но `load` берёт id своего типа (trackId/videoId/fileId). */
export interface JamSourceEngine {
  load(id: string): Promise<void>;
  play(): void;
  pause(): void;
  seek(ms: number): void;
  currentTimeMs(): number;
  isBuffering(): boolean;
  onEnded(listener: () => void): () => void;
  onPlaying(listener: () => void): () => void;
  onUserToggle(listener: (playing: boolean) => void): () => void;
  destroy(): void;
}

const FACTORIES: Record<PlayableSource['kind'], () => JamSourceEngine> = {
  VIRE: createVireSource,
  YOUTUBE: createYoutubeSource,
  SOUNDCLOUD: createSoundcloudSource,
  AUDIUS: createAudiusSource,
  LOCAL: createLocalSource,
};

function idOf(source: PlayableSource): string {
  switch (source.kind) {
    case 'VIRE': return source.trackId;
    case 'YOUTUBE': return source.videoId;
    case 'SOUNDCLOUD': return source.url;
    case 'AUDIUS': return source.trackId;
    case 'LOCAL': return source.fileId;
  }
}

/**
 * Диспетчер источников звука: один и тот же `JamAudioEngine` наружу, внутри — переключение
 * между VIRE (HLS)/YOUTUBE (IFrame API)/LOCAL (`<audio>` над файлом) по `kind` позиции очереди.
 * Смена `kind` уничтожает предыдущий под-движок и создаёт новый; смена id в рамках того же
 * kind (VIRE→VIRE на другой трек) переиспользует его.
 */
export function createJamAudio(): JamAudioEngine {
  let active: JamSourceEngine | null = null;
  let activeKind: PlayableSource['kind'] | null = null;
  const endedListeners = new Set<() => void>();
  const playingListeners = new Set<() => void>();
  const userToggleListeners = new Set<(playing: boolean) => void>();
  let unsubEnded: (() => void) | null = null;
  let unsubPlaying: (() => void) | null = null;
  let unsubUserToggle: (() => void) | null = null;

  function attach(engine: JamSourceEngine): void {
    unsubEnded?.();
    unsubPlaying?.();
    unsubUserToggle?.();
    unsubEnded = engine.onEnded(() => endedListeners.forEach((l) => l()));
    unsubPlaying = engine.onPlaying(() => playingListeners.forEach((l) => l()));
    unsubUserToggle = engine.onUserToggle((playing) => userToggleListeners.forEach((l) => l(playing)));
  }

  return {
    async load(source) {
      if (activeKind !== source.kind) {
        active?.destroy();
        active = FACTORIES[source.kind]();
        activeKind = source.kind;
        attach(active);
      }
      await active!.load(idOf(source));
    },

    play(): void {
      active?.play();
    },

    pause(): void {
      active?.pause();
    },

    seek(ms: number): void {
      active?.seek(ms);
    },

    currentTimeMs(): number {
      return active?.currentTimeMs() ?? 0;
    },

    isBuffering(): boolean {
      return active?.isBuffering() ?? false;
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
      unsubEnded?.();
      unsubPlaying?.();
      unsubUserToggle?.();
      active?.destroy();
      active = null;
      activeKind = null;
      endedListeners.clear();
      playingListeners.clear();
      userToggleListeners.clear();
    },
  };
}

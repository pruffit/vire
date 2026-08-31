export type AudioEngineEvent =
  | 'timeupdate'
  | 'ended'
  | 'stalled'
  | 'error'
  | 'remoteNext'
  | 'remotePrevious'
  | 'remoteLike'
  | 'statechange';
export type Unsubscribe = () => void;

export interface AudioEngineSource {
  manifestUrl: string;
  startAt?: number;
  /** Now Playing / lock-screen метаданные — опциональны, движки без OS-интеграции их игнорируют. */
  title?: string;
  artist?: string;
  artworkUrl?: string;
}

/**
 * Платформенный аудио-драйвер за одним портом: веб реализует через hls.js + <audio>,
 * мобильный — через react-native-track-player. Всё выше порта (очередь, порядок,
 * shuffle/repeat, что играть дальше) — платформо-нейтральная логика в этом пакете
 * (services/queue.ts, services/engine-policy.ts), driver знает только про воспроизведение
 * одного трека. См. docs/multiplatform.md §5.
 */
export interface IAudioEngine {
  load(src: AudioEngineSource): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(sec: number): void;
  on(event: AudioEngineEvent, cb: (payload?: unknown) => void): Unsubscribe;
}

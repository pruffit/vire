export type AudioEngineEvent = 'timeupdate' | 'ended' | 'stalled' | 'error';
export type Unsubscribe = () => void;

export interface AudioEngineSource {
  manifestUrl: string;
  startAt?: number;
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

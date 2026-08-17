import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';
import type {
  AudioEngineEvent,
  AudioEngineSource,
  IAudioEngine,
  Unsubscribe,
} from '@vire/core/playback/audio-engine';

export interface AudioTimeUpdate {
  currentTime: number;
  duration: number;
}

type Listener = (payload?: unknown) => void;

function waitUntilLoaded(player: AudioPlayer): Promise<void> {
  return new Promise((resolve, reject) => {
    const sub = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (status.error) {
        sub.remove();
        reject(new Error(status.error));
        return;
      }
      if (status.isLoaded) {
        sub.remove();
        resolve();
      }
    });
  });
}

/**
 * IAudioEngine поверх expo-audio: один переиспользуемый AudioPlayer на всё приложение,
 * load() подменяет источник через replace() вместо создания нового плеера на каждый трек
 * (HLS-манифест плеер понимает нативно — AVPlayer/ExoPlayer/HTMLAudioElement, без доп. настройки).
 */
export class ExpoAudioEngine implements IAudioEngine {
  private readonly player: AudioPlayer;
  private readonly listeners: Record<AudioEngineEvent, Set<Listener>> = {
    timeupdate: new Set(),
    ended: new Set(),
    stalled: new Set(),
    error: new Set(),
  };
  private wasBuffering = false;

  constructor() {
    this.player = createAudioPlayer(null);
    this.player.addListener('playbackStatusUpdate', (status) => this.handleStatus(status));
  }

  async load(src: AudioEngineSource): Promise<void> {
    this.wasBuffering = false;
    this.player.replace({ uri: src.manifestUrl });
    await waitUntilLoaded(this.player);
    if (src.startAt) {
      await this.player.seekTo(src.startAt);
    }
  }

  async play(): Promise<void> {
    this.player.play();
  }

  pause(): void {
    this.player.pause();
  }

  seek(sec: number): void {
    this.player.seekTo(sec);
  }

  on(event: AudioEngineEvent, cb: Listener): Unsubscribe {
    this.listeners[event].add(cb);
    return () => this.listeners[event].delete(cb);
  }

  private handleStatus(status: AudioStatus): void {
    if (status.error) {
      this.emit('error', status.error);
      return;
    }
    if (status.didJustFinish) {
      this.emit('ended');
      return;
    }
    if (status.isBuffering !== this.wasBuffering) {
      this.wasBuffering = status.isBuffering;
      if (status.isBuffering) this.emit('stalled');
    }
    if (status.isLoaded) {
      this.emit('timeupdate', { currentTime: status.currentTime, duration: status.duration } satisfies AudioTimeUpdate);
    }
  }

  private emit(event: AudioEngineEvent, payload?: unknown): void {
    for (const cb of this.listeners[event]) cb(payload);
  }
}

export const audioEngine: IAudioEngine = new ExpoAudioEngine();

import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
  type Track,
} from 'react-native-track-player';
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

const PROGRESS_POLL_MS = 500;

const TRANSPORT_CAPABILITIES = [
  Capability.Play,
  Capability.Pause,
  Capability.SkipToNext,
  Capability.SkipToPrevious,
  Capability.SeekTo,
  Capability.Stop,
];

function waitUntilReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const stateSub = TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
      if (state === State.Ready || state === State.Playing || state === State.Paused) {
        stateSub.remove();
        errorSub.remove();
        resolve();
      }
    });
    const errorSub = TrackPlayer.addEventListener(Event.PlaybackError, (payload) => {
      stateSub.remove();
      errorSub.remove();
      reject(new Error(payload.message));
    });
  });
}

/**
 * IAudioEngine поверх react-native-track-player: очередь остаётся в player-store
 * (nextQueueIndex и т.п. из @vire/core), движок проигрывает один трек за раз через
 * load() — тот же контракт, что и предыдущий ExpoAudioEngine. RNTP заменил expo-audio
 * ради нативного foreground-service + lock-screen/Now Playing (см. инкремент 5,
 * docs/features/mobile-app.md) — remote-команды (play/pause/next/prev/seek) и смена
 * состояния плеера (в т.ч. инициированная с экрана блокировки) транслируются через
 * порт события 'remoteNext'/'remotePrevious'/'statechange', которые слушает player-store,
 * не через прямой импорт стора сюда (порт остаётся однонаправленным).
 */
export class TrackPlayerAudioEngine implements IAudioEngine {
  private readonly listeners: Record<AudioEngineEvent, Set<Listener>> = {
    timeupdate: new Set(),
    ended: new Set(),
    stalled: new Set(),
    error: new Set(),
    remoteNext: new Set(),
    remotePrevious: new Set(),
    statechange: new Set(),
  };
  private setupPromise: Promise<void> | null = null;
  private wasBuffering = false;
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => this.emit('ended'));
    TrackPlayer.addEventListener(Event.PlaybackError, (payload) => this.emit('error', payload.message));
    TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
      const isBuffering = state === State.Buffering || state === State.Loading;
      if (isBuffering !== this.wasBuffering) {
        this.wasBuffering = isBuffering;
        if (isBuffering) this.emit('stalled');
      }
      if (state === State.Playing) this.emit('statechange', { isPlaying: true });
      if (state === State.Paused) this.emit('statechange', { isPlaying: false });
    });

    // remote-* — команды с lock-screen/уведомления/наушников. Play/Pause применяются
    // напрямую к тому же нативному плееру (эмитят statechange выше и синхронизируют
    // player-store), next/prev эмитятся портом наружу — очередью владеет player-store,
    // не RNTP (см. докстринг класса).
    TrackPlayer.addEventListener(Event.RemotePlay, () => {
      TrackPlayer.play();
    });
    TrackPlayer.addEventListener(Event.RemotePause, () => {
      TrackPlayer.pause();
    });
    TrackPlayer.addEventListener(Event.RemoteStop, () => {
      TrackPlayer.pause();
    });
    TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
      TrackPlayer.seekTo(position);
    });
    TrackPlayer.addEventListener(Event.RemoteNext, () => this.emit('remoteNext'));
    TrackPlayer.addEventListener(Event.RemotePrevious, () => this.emit('remotePrevious'));

    // Event.PlaybackProgressUpdated не гарантированно шлётся с нужной частотой на всех
    // версиях/платформах (официальный хук useProgress() в самой RNTP тоже не полагается
    // на это событие — поллит getProgress()) — поллинг здесь тот же, проверенный подход.
    this.progressTimer = setInterval(() => {
      TrackPlayer.getProgress()
        .then(({ position, duration }) => {
          if (duration > 0) this.emit('timeupdate', { currentTime: position, duration } satisfies AudioTimeUpdate);
        })
        .catch(() => {
          // getProgress() бросает, пока плеер не проинициализирован/трек не загружен — ожидаемо, игнорируем.
        });
    }, PROGRESS_POLL_MS);
    // unref в Node (vitest) — открытый интервал не держит процесс живым после тестов;
    // в RN-рантайме таймер-id числовой, unref на нём просто нет, опциональный вызов безопасен.
    (this.progressTimer as unknown as { unref?: () => void }).unref?.();
  }

  // setupPlayer() — только по требованию, не в конструкторе: Android 12+ запрещает
  // стартовать foreground-service (RNTP поднимает его внутри setupPlayer/play), пока
  // Activity ещё не считается по-настоящему foreground для ActivityManager — окно между
  // стартом JS-бандла и полным onResume() под это не подходит и валит
  // ForegroundServiceStartNotAllowedException. Первый вызов load()/play() приходит по
  // тапу пользователя — Activity к этому моменту точно в foreground.
  private ensureReady(): Promise<void> {
    if (!this.setupPromise) {
      this.setupPromise = TrackPlayer.setupPlayer({
        // Звонок, будильник, чужой плеер: без этого RNTP не отпускает аудиофокус и
        // приложение продолжает играть поверх — для музыкального продукта это отказ.
        autoHandleInterruptions: true,
      })
        .catch((err) => {
          // setupPlayer() бросает, если плеер уже инициализирован (hot reload/повторный
          // импорт модуля) — не фатально, дальнейшие вызовы всё равно работают с тем же плеером.
          console.warn('[player] setupPlayer()', err);
        })
        .then(() =>
          TrackPlayer.updateOptions({
            capabilities: TRANSPORT_CAPABILITIES,
            compactCapabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
            ],
            progressUpdateEventInterval: 1,
            android: {
              appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
              // Короткое чужое уведомление (навигатор, сообщение) глушит нас паузой, а не
              // притишиванием: музыку под голосовую подсказку слушать всё равно нельзя.
              alwaysPauseOnInterruption: true,
            },
          }),
        );
    }
    return this.setupPromise;
  }

  async load(src: AudioEngineSource): Promise<void> {
    await this.ensureReady();
    this.wasBuffering = false;
    const track: Track = {
      url: src.manifestUrl,
      type: 'hls' as Track['type'],
      title: src.title,
      artist: src.artist,
      artwork: src.artworkUrl,
    };
    const readyPromise = waitUntilReady();
    await TrackPlayer.load(track);
    await readyPromise;
    if (src.startAt) {
      await TrackPlayer.seekTo(src.startAt);
    }
  }

  async play(): Promise<void> {
    await this.ensureReady();
    await TrackPlayer.play();
  }

  pause(): void {
    TrackPlayer.pause();
  }

  seek(sec: number): void {
    TrackPlayer.seekTo(sec);
  }

  on(event: AudioEngineEvent, cb: Listener): Unsubscribe {
    this.listeners[event].add(cb);
    return () => this.listeners[event].delete(cb);
  }

  private emit(event: AudioEngineEvent, payload?: unknown): void {
    for (const cb of this.listeners[event]) cb(payload);
  }
}

export const audioEngine: IAudioEngine = new TrackPlayerAudioEngine();

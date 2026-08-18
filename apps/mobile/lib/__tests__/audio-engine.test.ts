import { describe, it, expect, vi, beforeEach } from 'vitest';

const { TrackPlayer, emitNative, Event, State } = vi.hoisted(() => {
  const listeners: Record<string, Array<(payload?: unknown) => void>> = {};

  const Event = {
    PlaybackQueueEnded: 'playback-queue-ended',
    PlaybackError: 'playback-error',
    PlaybackState: 'playback-state',
    RemotePlay: 'remote-play',
    RemotePause: 'remote-pause',
    RemoteStop: 'remote-stop',
    RemoteSeek: 'remote-seek',
    RemoteNext: 'remote-next',
    RemotePrevious: 'remote-previous',
  };

  const State = {
    Ready: 'ready',
    Playing: 'playing',
    Paused: 'paused',
    Buffering: 'buffering',
    Loading: 'loading',
    Error: 'error',
  };

  const TrackPlayer = {
    setupPlayer: vi.fn().mockResolvedValue(undefined),
    updateOptions: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((event: string, cb: (payload?: unknown) => void) => {
      (listeners[event] ??= []).push(cb);
      return {
        remove: () => {
          listeners[event] = (listeners[event] ?? []).filter((l) => l !== cb);
        },
      };
    }),
    load: vi.fn().mockResolvedValue(undefined),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    seekTo: vi.fn().mockResolvedValue(undefined),
    getProgress: vi.fn().mockResolvedValue({ position: 0, duration: 0, buffered: 0 }),
  };

  const emitNative = (event: string, payload?: unknown) => {
    (listeners[event] ?? []).forEach((cb) => cb(payload));
  };

  return { TrackPlayer, emitNative, Event, State };
});

vi.mock('react-native-track-player', () => ({
  default: TrackPlayer,
  Event,
  State,
  Capability: {
    Play: 'play',
    Pause: 'pause',
    Stop: 'stop',
    SkipToNext: 'skip-next',
    SkipToPrevious: 'skip-previous',
    SeekTo: 'seek-to',
  },
  AppKilledPlaybackBehavior: { ContinuePlayback: 'continue-playback' },
}));

// Singleton создаётся один раз при импорте модуля (как в реальном приложении) —
// все тесты работают через него, не плодят параллельные инстансы (иначе они делили бы
// один и тот же глобальный TrackPlayer.addEventListener и дублировали побочные эффекты).
import { audioEngine } from '../audio-engine';

beforeEach(() => {
  vi.clearAllMocks();
});

// load() ждёт this.ready (промис-цепочка setupPlayer().then(updateOptions)) прежде чем
// зарегистрировать слушатель готовности и позвать TrackPlayer.load — реальные микротаски,
// не синхронно. flush() догоняет их макротаском, как и в player-store.test.ts.
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function resolveLoad() {
  const promise = audioEngine.load({ manifestUrl: 'https://cdn/track.m3u8', title: 'T', artist: 'A' });
  await flush();
  emitNative(Event.PlaybackState, { state: State.Ready });
  return promise;
}

describe('TrackPlayerAudioEngine.load', () => {
  it('грузит трек с type: hls и метаданными, резолвится по PlaybackState Ready', async () => {
    const loadPromise = audioEngine.load({
      manifestUrl: 'https://cdn/track.m3u8',
      title: 'Track',
      artist: 'Artist',
      artworkUrl: 'https://cdn/cover.jpg',
    });
    await flush();
    expect(TrackPlayer.load).toHaveBeenCalledWith({
      url: 'https://cdn/track.m3u8',
      type: 'hls',
      title: 'Track',
      artist: 'Artist',
      artwork: 'https://cdn/cover.jpg',
    });

    emitNative(Event.PlaybackState, { state: State.Ready });
    await loadPromise;
  });

  it('startAt — после готовности вызывает seekTo', async () => {
    const loadPromise = audioEngine.load({ manifestUrl: 'https://cdn/track.m3u8', startAt: 30 });
    await flush();
    emitNative(Event.PlaybackState, { state: State.Ready });
    await loadPromise;

    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(30);
  });

  it('PlaybackError во время загрузки — load() отклоняется', async () => {
    const loadPromise = audioEngine.load({ manifestUrl: 'https://cdn/track.m3u8' });
    await flush();
    emitNative(Event.PlaybackError, { code: 'network', message: 'network down' });

    await expect(loadPromise).rejects.toThrow('network down');
  });
});

describe('TrackPlayerAudioEngine — транспорт', () => {
  it('play/pause/seek делегируют TrackPlayer', async () => {
    await resolveLoad();
    vi.clearAllMocks();

    await audioEngine.play();
    audioEngine.pause();
    audioEngine.seek(15);

    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(15);
  });
});

describe('TrackPlayerAudioEngine — события плеера', () => {
  it('PlaybackQueueEnded эмитит ended', () => {
    const onEnded = vi.fn();
    const unsubscribe = audioEngine.on('ended', onEnded);

    emitNative(Event.PlaybackQueueEnded, { track: 0, position: 180 });

    expect(onEnded).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('PlaybackError эмитит error с текстом сообщения', () => {
    const onError = vi.fn();
    const unsubscribe = audioEngine.on('error', onError);

    emitNative(Event.PlaybackError, { code: 'boom', message: 'boom message' });

    expect(onError).toHaveBeenCalledWith('boom message');
    unsubscribe();
  });

  it('PlaybackState Buffering эмитит stalled только на переход (edge), не на повтор', () => {
    const onStalled = vi.fn();
    const unsubscribe = audioEngine.on('stalled', onStalled);

    emitNative(Event.PlaybackState, { state: State.Buffering });
    emitNative(Event.PlaybackState, { state: State.Buffering });
    expect(onStalled).toHaveBeenCalledTimes(1);

    emitNative(Event.PlaybackState, { state: State.Playing });
    emitNative(Event.PlaybackState, { state: State.Buffering });
    expect(onStalled).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('PlaybackState Playing/Paused эмитит statechange — синхронизация status стора при remote play/pause', () => {
    const onStateChange = vi.fn();
    const unsubscribe = audioEngine.on('statechange', onStateChange);

    emitNative(Event.PlaybackState, { state: State.Playing });
    expect(onStateChange).toHaveBeenLastCalledWith({ isPlaying: true });

    emitNative(Event.PlaybackState, { state: State.Paused });
    expect(onStateChange).toHaveBeenLastCalledWith({ isPlaying: false });

    unsubscribe();
  });

  it('on() возвращает unsubscribe, после которого колбэк больше не вызывается', () => {
    const onEnded = vi.fn();
    const unsubscribe = audioEngine.on('ended', onEnded);

    emitNative(Event.PlaybackQueueEnded, { track: 0, position: 0 });
    expect(onEnded).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitNative(Event.PlaybackQueueEnded, { track: 0, position: 0 });
    expect(onEnded).toHaveBeenCalledTimes(1);
  });
});

describe('TrackPlayerAudioEngine — remote-команды (lock-screen/уведомление)', () => {
  it('RemoteNext/RemotePrevious эмитятся портом наружу — очередью владеет player-store, не движок', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const unsubNext = audioEngine.on('remoteNext', onNext);
    const unsubPrev = audioEngine.on('remotePrevious', onPrev);

    emitNative(Event.RemoteNext);
    emitNative(Event.RemotePrevious);

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
    unsubNext();
    unsubPrev();
  });

  it('RemotePlay/RemotePause применяются напрямую к нативному плееру', () => {
    emitNative(Event.RemotePlay);
    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);

    emitNative(Event.RemotePause);
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('RemoteSeek вызывает seekTo с позицией из события', () => {
    emitNative(Event.RemoteSeek, { position: 77 });
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(77);
  });
});

describe('TrackPlayerAudioEngine — прогресс (поллинг getProgress)', () => {
  // Интервал — настоящий setInterval, созданный один раз при импорте модуля (до
  // beforeEach любого теста) — фейковые таймеры, включённые постфактум, его не ловят.
  // Ждём реальное время несколько циклов поллинга (PROGRESS_POLL_MS=500) вместо этого.
  it('поллит getProgress() и эмитит timeupdate, когда duration > 0', async () => {
    const onTimeUpdate = vi.fn();
    const unsubscribe = audioEngine.on('timeupdate', onTimeUpdate);
    TrackPlayer.getProgress.mockResolvedValue({ position: 42, duration: 180, buffered: 50 });

    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(onTimeUpdate).toHaveBeenCalledWith({ currentTime: 42, duration: 180 });
    unsubscribe();
  }, 10000);

  it('duration=0 (ничего не загружено) — timeupdate не эмитится', async () => {
    const onTimeUpdate = vi.fn();
    const unsubscribe = audioEngine.on('timeupdate', onTimeUpdate);
    TrackPlayer.getProgress.mockResolvedValue({ position: 0, duration: 0, buffered: 0 });

    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(onTimeUpdate).not.toHaveBeenCalled();
    unsubscribe();
  }, 10000);
});

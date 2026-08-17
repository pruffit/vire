import { describe, it, expect, vi, beforeEach } from 'vitest';

const { FakePlayer, players } = vi.hoisted(() => {
  type FakeStatus = Partial<{
    error: string | null;
    didJustFinish: boolean;
    isBuffering: boolean;
    isLoaded: boolean;
    currentTime: number;
    duration: number;
  }>;

  class FakePlayer {
    listeners: Record<string, Array<(status: FakeStatus) => void>> = {};
    replaceCalls: unknown[] = [];
    playCalls = 0;
    pauseCalls = 0;
    seekCalls: number[] = [];

    addListener(event: string, cb: (status: FakeStatus) => void) {
      (this.listeners[event] ??= []).push(cb);
      return {
        remove: () => {
          this.listeners[event] = (this.listeners[event] ?? []).filter((l) => l !== cb);
        },
      };
    }
    replace(source: unknown) {
      this.replaceCalls.push(source);
    }
    play() {
      this.playCalls++;
    }
    pause() {
      this.pauseCalls++;
    }
    seekTo(sec: number) {
      this.seekCalls.push(sec);
      return Promise.resolve();
    }
    emit(status: FakeStatus) {
      for (const cb of this.listeners.playbackStatusUpdate ?? []) cb(status);
    }
  }

  const players: FakePlayer[] = [];
  return { FakePlayer, players };
});

vi.mock('expo-audio', () => ({
  createAudioPlayer: vi.fn(() => {
    const player = new FakePlayer();
    players.push(player);
    return player;
  }),
}));

import { ExpoAudioEngine } from '../audio-engine';

const loadedStatus = { error: null, isLoaded: true, isBuffering: false, didJustFinish: false, currentTime: 0, duration: 100 };

beforeEach(() => {
  players.length = 0;
});

describe('ExpoAudioEngine.load', () => {
  it('подменяет источник через replace() и резолвится, когда плеер сообщает isLoaded', async () => {
    const engine = new ExpoAudioEngine();
    const player = players[0];

    const loadPromise = engine.load({ manifestUrl: 'https://cdn/track.m3u8' });
    expect(player.replaceCalls).toEqual([{ uri: 'https://cdn/track.m3u8' }]);
    player.emit(loadedStatus);
    await loadPromise;
  });

  it('startAt — после загрузки вызывает seekTo', async () => {
    const engine = new ExpoAudioEngine();
    const player = players[0];

    const loadPromise = engine.load({ manifestUrl: 'https://cdn/track.m3u8', startAt: 30 });
    player.emit(loadedStatus);
    await loadPromise;

    expect(player.seekCalls).toEqual([30]);
  });

  it('ошибка статуса во время загрузки — load() отклоняется', async () => {
    const engine = new ExpoAudioEngine();
    const player = players[0];

    const loadPromise = engine.load({ manifestUrl: 'https://cdn/track.m3u8' });
    player.emit({ error: 'network down' });

    await expect(loadPromise).rejects.toThrow('network down');
  });
});

describe('ExpoAudioEngine — транспорт', () => {
  it('play/pause/seek делегируют плееру', async () => {
    const engine = new ExpoAudioEngine();
    const player = players[0];

    await engine.play();
    engine.pause();
    engine.seek(15);

    expect(player.playCalls).toBe(1);
    expect(player.pauseCalls).toBe(1);
    expect(player.seekCalls).toEqual([15]);
  });
});

describe('ExpoAudioEngine — события', () => {
  it('timeupdate передаёт currentTime/duration на обычный статус-апдейт', async () => {
    const engine = new ExpoAudioEngine();
    const player = players[0];
    const onTimeUpdate = vi.fn();
    engine.on('timeupdate', onTimeUpdate);

    player.emit({ ...loadedStatus, currentTime: 42, duration: 180 });

    expect(onTimeUpdate).toHaveBeenCalledWith({ currentTime: 42, duration: 180 });
  });

  it('didJustFinish эмитит ended вместо timeupdate', async () => {
    const engine = new ExpoAudioEngine();
    const player = players[0];
    const onEnded = vi.fn();
    const onTimeUpdate = vi.fn();
    engine.on('ended', onEnded);
    engine.on('timeupdate', onTimeUpdate);

    player.emit({ ...loadedStatus, didJustFinish: true });

    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onTimeUpdate).not.toHaveBeenCalled();
  });

  it('error эмитит error вместо timeupdate', async () => {
    const engine = new ExpoAudioEngine();
    const player = players[0];
    const onError = vi.fn();
    engine.on('error', onError);

    player.emit({ error: 'boom' });

    expect(onError).toHaveBeenCalledWith('boom');
  });

  it('stalled эмитится только на переход в буферизацию (edge), не на повтор', async () => {
    const engine = new ExpoAudioEngine();
    const player = players[0];
    const onStalled = vi.fn();
    engine.on('stalled', onStalled);

    player.emit({ ...loadedStatus, isBuffering: true });
    player.emit({ ...loadedStatus, isBuffering: true });
    expect(onStalled).toHaveBeenCalledTimes(1);

    player.emit({ ...loadedStatus, isBuffering: false });
    player.emit({ ...loadedStatus, isBuffering: true });
    expect(onStalled).toHaveBeenCalledTimes(2);
  });

  it('on() возвращает unsubscribe, после которого колбэк больше не вызывается', async () => {
    const engine = new ExpoAudioEngine();
    const player = players[0];
    const onTimeUpdate = vi.fn();
    const unsubscribe = engine.on('timeupdate', onTimeUpdate);

    player.emit(loadedStatus);
    expect(onTimeUpdate).toHaveBeenCalledTimes(1);

    unsubscribe();
    player.emit(loadedStatus);
    expect(onTimeUpdate).toHaveBeenCalledTimes(1);
  });
});

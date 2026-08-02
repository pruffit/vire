// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { JamPlaybackState } from '@vire/core';

const { createJamAudioMock } = vi.hoisted(() => ({ createJamAudioMock: vi.fn() }));
vi.mock('./jam-audio', () => ({ createJamAudio: createJamAudioMock }));

import { usePlaybackSync } from './use-playback-sync';

interface FakeEngine {
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  currentTimeMs: ReturnType<typeof vi.fn>;
  isBuffering: ReturnType<typeof vi.fn>;
  onEnded: ReturnType<typeof vi.fn>;
  onPlaying: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  firePlaying: () => void;
}

function makeFakeEngine(): FakeEngine {
  const playingListeners = new Set<() => void>();
  return {
    load: vi.fn(async () => {}),
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    currentTimeMs: vi.fn(() => 0),
    isBuffering: vi.fn(() => false),
    onEnded: vi.fn(() => vi.fn()),
    onPlaying: vi.fn((listener: () => void) => {
      playingListeners.add(listener);
      return () => playingListeners.delete(listener);
    }),
    destroy: vi.fn(),
    firePlaying: () => playingListeners.forEach((l) => l()),
  };
}

function playback(overrides: Partial<JamPlaybackState> = {}): JamPlaybackState {
  return { itemId: 'item-1', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1, ...overrides };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

let engine: FakeEngine;

beforeEach(() => {
  engine = makeFakeEngine();
  createJamAudioMock.mockReturnValue(engine);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  createJamAudioMock.mockReset();
});

describe('usePlaybackSync', () => {
  it('не создаёт движок, пока звук не разблокирован', async () => {
    renderHook(() => usePlaybackSync({ playback: playback(), trackId: 'track-1', serverNow: () => 0, audioEnabled: false }));
    await flush();

    expect(createJamAudioMock).not.toHaveBeenCalled();
  });

  it('на новый трек грузит, делает грубый seek сразу и запускает, если не на паузе', async () => {
    const pb = playback({ startedAtMs: -5_000 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow: () => 0, audioEnabled: true }));
    await flush();

    expect(engine.load).toHaveBeenCalledWith('track-1');
    expect(engine.seek).toHaveBeenCalledWith(5_000);
    expect(engine.play).toHaveBeenCalledTimes(1);
  });

  it('trackId=null (внешний источник) — не грузит и не играет', async () => {
    const pb = playback({ startedAtMs: -5_000 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: null, serverNow: () => 0, audioEnabled: true }));
    await flush();

    expect(engine.load).not.toHaveBeenCalled();
    expect(engine.play).not.toHaveBeenCalled();
  });

  it('трек, доехавший позже playback (снапшот очереди отстал), всё равно грузится', async () => {
    const pb = playback({ startedAtMs: -5_000 });
    const { rerender } = renderHook(
      ({ trackId }: { trackId: string | null }) =>
        usePlaybackSync({ playback: pb, trackId, serverNow: () => 0, audioEnabled: true }),
      { initialProps: { trackId: null as string | null } },
    );
    await flush();
    expect(engine.load).not.toHaveBeenCalled();

    rerender({ trackId: 'track-1' });
    await flush();

    expect(engine.load).toHaveBeenCalledWith('track-1');
    expect(engine.play).toHaveBeenCalledTimes(1);
  });

  it('точная позиция выставляется только после первого playing, с учётом времени буферизации', async () => {
    let now = 5_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow: () => now, audioEnabled: true }));
    await flush();
    expect(engine.seek).toHaveBeenCalledWith(5_000);

    engine.seek.mockClear();
    now = 6_200; // время ушло на буферизацию первого сегмента, пока звук не пошёл
    act(() => engine.firePlaying());

    expect(engine.seek).toHaveBeenCalledWith(6_200);
  });

  it('повторное playing после первого ресинка не вызывает ещё один seek (одноразовая подписка)', async () => {
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow: () => 5_000, audioEnabled: true }));
    await flush();

    act(() => engine.firePlaying());
    engine.seek.mockClear();
    act(() => engine.firePlaying());

    expect(engine.seek).not.toHaveBeenCalled();
  });

  it('driftCorrection: false — ресинка по playing нет (одиночный джем не теряет начало трека)', async () => {
    let now = 0;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow: () => now, audioEnabled: true, driftCorrection: false }));
    await flush();

    engine.seek.mockClear();
    now = 2_000;
    act(() => engine.firePlaying());

    expect(engine.seek).not.toHaveBeenCalled();
  });

  it('трек на паузе при загрузке — позиционирует, но не запускает и не ждёт playing', async () => {
    const pb = playback({ paused: true, pausedPositionMs: 3_000 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow: () => 0, audioEnabled: true }));
    await flush();

    expect(engine.seek).toHaveBeenCalledWith(3_000);
    expect(engine.play).not.toHaveBeenCalled();
    expect(engine.onPlaying).not.toHaveBeenCalled();
  });

  it('смена позиции (itemId) в playback грузит новый трек и позиционирует заново', async () => {
    const pb1 = playback({ itemId: 'item-1', startedAtMs: 0 });
    const { rerender } = renderHook(
      ({ pb, trackId }: { pb: JamPlaybackState; trackId: string }) => usePlaybackSync({ playback: pb, trackId, serverNow: () => 0, audioEnabled: true }),
      { initialProps: { pb: pb1, trackId: 'track-1' } },
    );
    await flush();
    engine.load.mockClear();
    engine.seek.mockClear();

    const pb2 = playback({ itemId: 'item-2', startedAtMs: -1_000 });
    rerender({ pb: pb2, trackId: 'track-2' });
    await flush();

    expect(engine.load).toHaveBeenCalledWith('track-2');
    expect(engine.seek).toHaveBeenCalledWith(1_000);
  });

  it('позиция сменилась, пока грузился предыдущий трек — устаревший load не позиционирует', async () => {
    let resolveFirst: (() => void) | null = null;
    engine.load.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveFirst = resolve; }));

    const pb1 = playback({ itemId: 'item-1', startedAtMs: 0 });
    const { rerender } = renderHook(
      ({ pb, trackId }: { pb: JamPlaybackState; trackId: string }) => usePlaybackSync({ playback: pb, trackId, serverNow: () => 0, audioEnabled: true }),
      { initialProps: { pb: pb1, trackId: 'track-1' } },
    );
    await flush();

    rerender({ pb: playback({ itemId: 'item-2', startedAtMs: -7_000 }), trackId: 'track-2' });
    await flush();
    engine.seek.mockClear();
    engine.play.mockClear();

    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
    });

    expect(engine.seek).not.toHaveBeenCalled();
    expect(engine.play).not.toHaveBeenCalled();
  });

  it('paused → playing делает грубый seek, play() и ждёт playing; playing → paused вызывает pause() и отменяет ожидание', async () => {
    const playing = playback({ paused: false, startedAtMs: 0 });
    const { rerender } = renderHook(
      ({ pb }: { pb: JamPlaybackState }) => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow: () => 0, audioEnabled: true }),
      { initialProps: { pb: playing } },
    );
    await flush();
    engine.pause.mockClear();

    const paused = playback({ paused: true, pausedPositionMs: 7_000 });
    rerender({ pb: paused });
    await flush();
    expect(engine.pause).toHaveBeenCalledTimes(1);

    // Отменённое ожидание: playing после паузы не должен ничего сикать.
    engine.seek.mockClear();
    act(() => engine.firePlaying());
    expect(engine.seek).not.toHaveBeenCalled();

    engine.play.mockClear();
    engine.seek.mockClear();
    const resumed = playback({ paused: false, startedAtMs: -7_000 });
    rerender({ pb: resumed });
    await flush();

    expect(engine.seek).toHaveBeenCalledWith(7_000);
    expect(engine.play).toHaveBeenCalledTimes(1);
  });

  it('дрейф больше HARD_SEEK_MS — жёсткий seek на тике', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();

    engine.currentTimeMs.mockReturnValue(6_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(engine.seek).toHaveBeenCalledWith(10_000);
  });

  it('дрейф в пределах HARD_SEEK_MS — ничего не делает (нет тайм-стретча)', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();

    engine.currentTimeMs.mockReturnValue(9_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(engine.seek).not.toHaveBeenCalled();
  });

  it('буферизация подавляет коррекцию даже при большом дрейфе', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();

    engine.currentTimeMs.mockReturnValue(6_000);
    engine.isBuffering.mockReturnValue(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(engine.seek).not.toHaveBeenCalled();
  });

  it('cooldown подавляет коррекцию сразу после жёсткого seek, затем снова разрешает', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();

    engine.currentTimeMs.mockReturnValue(6_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(engine.seek).toHaveBeenCalledTimes(1);

    // Немедленный повторный прогон (напр. возврат вкладки) внутри окна cooldown — подавлен.
    engine.seek.mockClear();
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(engine.seek).not.toHaveBeenCalled();

    // Cooldown истёк — коррекция снова проходит.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(engine.seek).toHaveBeenCalledWith(10_000);
  });

  it('driftCorrection: false не вешает интервал и не корректирует дрейф даже при большом расхождении', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow, audioEnabled: true, driftCorrection: false }));
    await flush();
    engine.seek.mockClear();

    engine.currentTimeMs.mockReturnValue(6_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(engine.seek).not.toHaveBeenCalled();
  });

  it('visibilitychange запускает немедленный прогон, не дожидаясь тика', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();

    engine.currentTimeMs.mockReturnValue(6_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(engine.seek).toHaveBeenCalledWith(10_000);
  });

  it('размонтирование чистит интервал, слушатель visibilitychange и вызывает destroy движка', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    const { unmount } = renderHook(() => usePlaybackSync({ playback: pb, trackId: 'track-1', serverNow, audioEnabled: true }));
    await flush();

    unmount();
    expect(engine.destroy).toHaveBeenCalledTimes(1);

    engine.seek.mockClear();
    engine.currentTimeMs.mockReturnValue(6_000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(engine.seek).not.toHaveBeenCalled();
  });

  it('ended у движка вызывает onEnded', async () => {
    const onEnded = vi.fn();
    let endedHandler: (() => void) | undefined;
    engine.onEnded.mockImplementation((listener: () => void) => {
      endedHandler = listener;
      return vi.fn();
    });

    renderHook(() => usePlaybackSync({ playback: playback(), trackId: 'track-1', serverNow: () => 0, audioEnabled: true, onEnded }));
    await flush();

    endedHandler?.();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });
});

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
  setRate: ReturnType<typeof vi.fn>;
  currentTimeMs: ReturnType<typeof vi.fn>;
  isBuffering: ReturnType<typeof vi.fn>;
  onEnded: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function makeFakeEngine(): FakeEngine {
  return {
    load: vi.fn(async () => {}),
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setRate: vi.fn(),
    currentTimeMs: vi.fn(() => 0),
    isBuffering: vi.fn(() => false),
    onEnded: vi.fn(() => vi.fn()),
    destroy: vi.fn(),
  };
}

function playback(overrides: Partial<JamPlaybackState> = {}): JamPlaybackState {
  return { trackId: 'track-1', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1, ...overrides };
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
    renderHook(() => usePlaybackSync({ playback: playback(), serverNow: () => 0, audioEnabled: false }));
    await flush();

    expect(createJamAudioMock).not.toHaveBeenCalled();
  });

  it('на новый трек грузит, позиционирует по serverNow и запускает, если не на паузе', async () => {
    const pb = playback({ startedAtMs: -5_000 });
    renderHook(() => usePlaybackSync({ playback: pb, serverNow: () => 0, audioEnabled: true }));
    await flush();

    expect(engine.load).toHaveBeenCalledWith('track-1');
    expect(engine.seek).toHaveBeenCalledWith(5_000);
    expect(engine.play).toHaveBeenCalledTimes(1);
  });

  it('трек на паузе при загрузке — позиционирует, но не запускает', async () => {
    const pb = playback({ paused: true, pausedPositionMs: 3_000 });
    renderHook(() => usePlaybackSync({ playback: pb, serverNow: () => 0, audioEnabled: true }));
    await flush();

    expect(engine.seek).toHaveBeenCalledWith(3_000);
    expect(engine.play).not.toHaveBeenCalled();
  });

  it('смена trackId в playback грузит новый трек и позиционирует заново', async () => {
    const pb1 = playback({ trackId: 'track-1', startedAtMs: 0 });
    const { rerender } = renderHook(
      ({ pb }: { pb: JamPlaybackState }) => usePlaybackSync({ playback: pb, serverNow: () => 0, audioEnabled: true }),
      { initialProps: { pb: pb1 } },
    );
    await flush();
    engine.load.mockClear();
    engine.seek.mockClear();

    const pb2 = playback({ trackId: 'track-2', startedAtMs: -1_000 });
    rerender({ pb: pb2 });
    await flush();

    expect(engine.load).toHaveBeenCalledWith('track-2');
    expect(engine.seek).toHaveBeenCalledWith(1_000);
  });

  it('трек сменился, пока грузился предыдущий — устаревший load не позиционирует', async () => {
    let resolveFirst: (() => void) | null = null;
    engine.load.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveFirst = resolve; }));

    const pb1 = playback({ trackId: 'track-1', startedAtMs: 0 });
    const { rerender } = renderHook(
      ({ pb }: { pb: JamPlaybackState }) => usePlaybackSync({ playback: pb, serverNow: () => 0, audioEnabled: true }),
      { initialProps: { pb: pb1 } },
    );
    await flush();

    rerender({ pb: playback({ trackId: 'track-2', startedAtMs: -7_000 }) });
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

  it('paused → playing вызывает play() и репозиционирует; playing → paused вызывает pause()', async () => {
    const playing = playback({ paused: false, startedAtMs: 0 });
    const { rerender } = renderHook(
      ({ pb }: { pb: JamPlaybackState }) => usePlaybackSync({ playback: pb, serverNow: () => 0, audioEnabled: true }),
      { initialProps: { pb: playing } },
    );
    await flush();
    engine.pause.mockClear();

    const paused = playback({ paused: true, pausedPositionMs: 7_000 });
    rerender({ pb: paused });
    await flush();
    expect(engine.pause).toHaveBeenCalledTimes(1);

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
    renderHook(() => usePlaybackSync({ playback: pb, serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();
    engine.setRate.mockClear();

    engine.currentTimeMs.mockReturnValue(6_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(engine.seek).toHaveBeenCalledWith(10_000);
    expect(engine.setRate).toHaveBeenCalledWith(1);
  });

  it('средний дрейф — коррекция playbackRate без seek', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();
    engine.setRate.mockClear();

    engine.currentTimeMs.mockReturnValue(9_700);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(engine.setRate).toHaveBeenCalledWith(1.03);
    expect(engine.seek).not.toHaveBeenCalled();
  });

  it('дрейф внутри порога схождения — ничего не делает', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();
    engine.setRate.mockClear();

    engine.currentTimeMs.mockReturnValue(9_990);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(engine.seek).not.toHaveBeenCalled();
    expect(engine.setRate).not.toHaveBeenCalled();
  });

  it('буферизация подавляет коррекцию даже при большом дрейфе', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();
    engine.setRate.mockClear();

    engine.currentTimeMs.mockReturnValue(6_000);
    engine.isBuffering.mockReturnValue(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(engine.seek).not.toHaveBeenCalled();
    expect(engine.setRate).not.toHaveBeenCalled();
  });

  it('cooldown после жёсткого seek подавляет следующую коррекцию, затем снова разрешает seek', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();
    engine.setRate.mockClear();

    engine.currentTimeMs.mockReturnValue(6_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(engine.seek).toHaveBeenCalledTimes(1);

    engine.seek.mockClear();
    engine.setRate.mockClear();
    engine.currentTimeMs.mockReturnValue(6_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(engine.seek).not.toHaveBeenCalled();

    engine.currentTimeMs.mockReturnValue(6_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(engine.seek).toHaveBeenCalledWith(10_000);
  });

  it('visibilitychange запускает немедленный прогон, не дожидаясь тика', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    renderHook(() => usePlaybackSync({ playback: pb, serverNow, audioEnabled: true }));
    await flush();
    engine.seek.mockClear();
    engine.setRate.mockClear();

    engine.currentTimeMs.mockReturnValue(6_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(engine.seek).toHaveBeenCalledWith(10_000);
  });

  it('размонтирование чистит интервал, слушатель visibilitychange и вызывает destroy движка', async () => {
    const serverNow = () => 10_000;
    const pb = playback({ startedAtMs: 0 });
    const { unmount } = renderHook(() => usePlaybackSync({ playback: pb, serverNow, audioEnabled: true }));
    await flush();

    unmount();
    expect(engine.destroy).toHaveBeenCalledTimes(1);

    engine.seek.mockClear();
    engine.currentTimeMs.mockReturnValue(6_000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
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

    renderHook(() => usePlaybackSync({ playback: playback(), serverNow: () => 0, audioEnabled: true, onEnded }));
    await flush();

    endedHandler?.();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });
});

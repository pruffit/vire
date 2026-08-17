import { describe, it, expect, vi, beforeEach } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@vire/api-client', () => ({ request }));

const { audioEngine, emit } = vi.hoisted(() => {
  const listeners: Record<string, Array<(payload?: unknown) => void>> = {};
  return {
    audioEngine: {
      load: vi.fn().mockResolvedValue(undefined),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      seek: vi.fn(),
      on: vi.fn((event: string, cb: (payload?: unknown) => void) => {
        (listeners[event] ??= []).push(cb);
        return () => {
          listeners[event] = (listeners[event] ?? []).filter((l) => l !== cb);
        };
      }),
    },
    emit: (event: string, payload?: unknown) => {
      (listeners[event] ?? []).forEach((cb) => cb(payload));
    },
  };
});
vi.mock('../audio-engine', () => ({ audioEngine }));

import { usePlayerStore, type QueueTrack } from '../player-store';

const track = (id: string): QueueTrack => ({
  id,
  title: `Track ${id}`,
  artistName: 'Artist',
  coverUrl: null,
  durationSec: 120,
});

const manifestOk = (id: string) => ({ ok: true, data: { hlsUrl: `https://cdn/${id}.m3u8`, waveformPeaks: null } });

function resetStore() {
  usePlayerStore.setState({ queue: [], queueIndex: -1, status: 'idle', positionSec: 0, durationSec: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  request.mockImplementation((url: string) => {
    const id = url.split('/').at(-2);
    return Promise.resolve(manifestOk(id ?? ''));
  });
  resetStore();
});

describe('usePlayerStore.playQueue', () => {
  it('ставит очередь, грузит манифест стартового трека и запускает воспроизведение', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2'), track('t3')], 1);

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(usePlayerStore.getState().queue).toHaveLength(3);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/tracks/t2/manifest'),
      expect.objectContaining({ schema: expect.anything() }),
    );
    expect(audioEngine.load).toHaveBeenCalledWith({ manifestUrl: 'https://cdn/t2.m3u8' });
    expect(audioEngine.play).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().status).toBe('playing');
  });

  it('startIndex зажимается в границы очереди', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2')], 99);
    expect(usePlayerStore.getState().queueIndex).toBe(1);
  });

  it('пустая очередь — no-op', async () => {
    await usePlayerStore.getState().playQueue([], 0);
    expect(usePlayerStore.getState().queueIndex).toBe(-1);
    expect(audioEngine.load).not.toHaveBeenCalled();
  });

  it('манифест не грузится — status error', async () => {
    request.mockResolvedValueOnce({ ok: false, error: { status: 404, message: 'not found' } });
    await usePlayerStore.getState().playQueue([track('t1')], 0);
    expect(usePlayerStore.getState().status).toBe('error');
    expect(audioEngine.load).not.toHaveBeenCalled();
  });

  it('audioEngine.load() отклоняется (источник не воспроизводим) — status error, не бесконечный loading', async () => {
    audioEngine.load.mockRejectedValueOnce(new Error('unsupported source'));
    await usePlayerStore.getState().playQueue([track('t1')], 0);
    expect(usePlayerStore.getState().status).toBe('error');
    expect(audioEngine.play).not.toHaveBeenCalled();
  });
});

describe('usePlayerStore.next/prev', () => {
  it('next() переходит к следующему треку и грузит его манифест', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2'), track('t3')], 0);
    vi.clearAllMocks();

    usePlayerStore.getState().next();
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(audioEngine.load).toHaveBeenCalledWith({ manifestUrl: 'https://cdn/t2.m3u8' });
  });

  it('next() на последнем треке очереди — останавливается, индекс не двигается', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2')], 1);
    vi.clearAllMocks();

    usePlayerStore.getState().next();
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(usePlayerStore.getState().status).toBe('paused');
    expect(audioEngine.load).not.toHaveBeenCalled();
  });

  it('prev() на первом треке — no-op', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2')], 0);
    vi.clearAllMocks();

    usePlayerStore.getState().prev();
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(0);
    expect(audioEngine.load).not.toHaveBeenCalled();
  });

  it('prev() переходит к предыдущему треку', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2')], 1);
    vi.clearAllMocks();

    usePlayerStore.getState().prev();
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(0);
    expect(audioEngine.load).toHaveBeenCalledWith({ manifestUrl: 'https://cdn/t1.m3u8' });
  });

  it('устаревший ответ манифеста (индекс уже сменился) не проигрывается', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2'), track('t3')], 0);
    vi.clearAllMocks();

    let resolveFirst: (v: unknown) => void = () => {};
    request.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));

    usePlayerStore.getState().next(); // запрашивает манифест t2, не резолвится сразу
    usePlayerStore.getState().next(); // сразу переходит на t3
    await flush();

    resolveFirst(manifestOk('t2'));
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(2);
    expect(audioEngine.load).not.toHaveBeenCalledWith({ manifestUrl: 'https://cdn/t2.m3u8' });
  });
});

describe('usePlayerStore.togglePlayPause', () => {
  it('playing -> paused вызывает audioEngine.pause', async () => {
    await usePlayerStore.getState().playQueue([track('t1')], 0);
    usePlayerStore.getState().togglePlayPause();
    expect(audioEngine.pause).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().status).toBe('paused');
  });

  it('paused -> playing вызывает audioEngine.play', async () => {
    await usePlayerStore.getState().playQueue([track('t1')], 0);
    usePlayerStore.getState().togglePlayPause();
    vi.clearAllMocks();
    usePlayerStore.getState().togglePlayPause();
    expect(audioEngine.play).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().status).toBe('playing');
  });
});

describe('usePlayerStore.seek', () => {
  it('вызывает audioEngine.seek и сразу обновляет positionSec', async () => {
    await usePlayerStore.getState().playQueue([track('t1')], 0);
    usePlayerStore.getState().seek(42);
    expect(audioEngine.seek).toHaveBeenCalledWith(42);
    expect(usePlayerStore.getState().positionSec).toBe(42);
  });
});

describe('события audioEngine', () => {
  it('timeupdate обновляет positionSec/durationSec', async () => {
    emit('timeupdate', { currentTime: 12.5, duration: 180 });
    expect(usePlayerStore.getState().positionSec).toBe(12.5);
    expect(usePlayerStore.getState().durationSec).toBe(180);
  });

  it('ended переключает на следующий трек очереди', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2')], 0);
    vi.clearAllMocks();

    emit('ended');
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(audioEngine.load).toHaveBeenCalledWith({ manifestUrl: 'https://cdn/t2.m3u8' });
  });

  it('error переводит статус в error', () => {
    emit('error', 'boom');
    expect(usePlayerStore.getState().status).toBe('error');
  });
});

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

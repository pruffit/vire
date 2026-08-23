import { describe, it, expect, vi, beforeEach } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../api-client', () => ({ apiRequest: request }));

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

const { getDownloadedTrack } = vi.hoisted(() => ({ getDownloadedTrack: vi.fn() }));
vi.mock('../offline/download-manager', () => ({ getDownloadedTrack }));

import { usePlayerStore, __resetSeekGuardForTests, type QueueTrack } from '../player-store';

const track = (id: string): QueueTrack => ({
  id,
  title: `Track ${id}`,
  artistName: 'Artist',
  coverUrl: null,
  durationSec: 120,
});

const manifestOk = (id: string) => ({ ok: true, data: { hlsUrl: `https://cdn/${id}.m3u8`, waveformPeaks: null } });

function resetStore() {
  usePlayerStore.setState({
    queue: [],
    queueIndex: -1,
    status: 'idle',
    positionSec: 0,
    durationSec: 0,
    shuffle: false,
    repeat: 'off',
    originalQueue: null,
  });
  __resetSeekGuardForTests();
}

beforeEach(() => {
  vi.clearAllMocks();
  request.mockImplementation((url: string) => {
    const id = url.split('/').at(-2);
    return Promise.resolve(manifestOk(id ?? ''));
  });
  getDownloadedTrack.mockResolvedValue(null);
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
    expect(audioEngine.load).toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: 'https://cdn/t2.m3u8' }));
    expect(audioEngine.play).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().status).toBe('playing');
  });

  it('передаёт движку метаданные трека (title/artist/artworkUrl) — для Now Playing/lock-screen', async () => {
    await usePlayerStore.getState().playQueue([track('t1')], 0);

    expect(audioEngine.load).toHaveBeenCalledWith({
      manifestUrl: 'https://cdn/t1.m3u8',
      title: 'Track t1',
      artist: 'Artist',
      artworkUrl: undefined,
    });
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

describe('usePlayerStore.playQueue — скачанный трек (офлайн)', () => {
  it('трек скачан — играет локальный файл, apiRequest не вызывается', async () => {
    getDownloadedTrack.mockResolvedValue({
      id: 't1',
      title: 'Track t1',
      artistName: 'Artist',
      coverUrl: null,
      durationSec: 120,
      bytes: 1000,
      addedAt: 0,
      localPlaylistPath: 'file:///offline/t1/playlist.m3u8',
    });

    await usePlayerStore.getState().playQueue([track('t1')], 0);

    expect(request).not.toHaveBeenCalled();
    expect(audioEngine.load).toHaveBeenCalledWith(
      expect.objectContaining({ manifestUrl: 'file:///offline/t1/playlist.m3u8' }),
    );
    expect(audioEngine.play).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().status).toBe('playing');
  });

  it('трек не скачан — обычный сетевой путь, как раньше', async () => {
    await usePlayerStore.getState().playQueue([track('t1')], 0);

    expect(getDownloadedTrack).toHaveBeenCalledWith('t1');
    expect(request).toHaveBeenCalled();
    expect(audioEngine.load).toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: 'https://cdn/t1.m3u8' }));
  });
});

describe('usePlayerStore.next/prev', () => {
  it('next() переходит к следующему треку и грузит его манифест', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2'), track('t3')], 0);
    vi.clearAllMocks();

    usePlayerStore.getState().next();
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(audioEngine.load).toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: 'https://cdn/t2.m3u8' }));
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
    expect(audioEngine.load).toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: 'https://cdn/t1.m3u8' }));
  });

  it('устаревший ответ манифеста (индекс уже сменился) не проигрывается', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2'), track('t3')], 0);
    vi.clearAllMocks();
    getDownloadedTrack.mockResolvedValue(null);

    // Гонка теперь начинается на getDownloadedTrack — первый вызов (t2) зависает, второй
    // (t3) резолвится сразу через дефолт выше.
    let resolveFirst: (v: unknown) => void = () => {};
    getDownloadedTrack.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));

    usePlayerStore.getState().next(); // запрашивает манифест t2, не резолвится сразу
    usePlayerStore.getState().next(); // сразу переходит на t3
    await flush();

    resolveFirst(null);
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(2);
    expect(audioEngine.load).not.toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: 'https://cdn/t2.m3u8' }));
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

  it('устаревший timeupdate сразу после seek не перетирает выставленную позицию', async () => {
    await usePlayerStore.getState().playQueue([track('t1')], 0);
    usePlayerStore.getState().seek(42);

    // Драйвер может отдать тик со старой позицией, пока нативный плеер ещё не догнал
    // seekTo() — такой тик должен быть проигнорирован в течение guard-окна.
    emit('timeupdate', { currentTime: 3, duration: 120 });

    expect(usePlayerStore.getState().positionSec).toBe(42);
  });

  it('timeupdate после сброса guard (следующий трек) обновляет позицию как обычно', async () => {
    await usePlayerStore.getState().playQueue([track('t1')], 0);
    usePlayerStore.getState().seek(42);
    __resetSeekGuardForTests();

    emit('timeupdate', { currentTime: 7, duration: 120 });

    expect(usePlayerStore.getState().positionSec).toBe(7);
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
    expect(audioEngine.load).toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: 'https://cdn/t2.m3u8' }));
  });

  it('error переводит статус в error', () => {
    emit('error', 'boom');
    expect(usePlayerStore.getState().status).toBe('error');
  });

  it('remoteNext (lock-screen) переходит к следующему треку — та же логика, что и next()', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2')], 0);
    vi.clearAllMocks();

    emit('remoteNext');
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(audioEngine.load).toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: 'https://cdn/t2.m3u8' }));
  });

  it('remotePrevious (lock-screen) переходит к предыдущему треку', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2')], 1);
    vi.clearAllMocks();

    emit('remotePrevious');
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(0);
    expect(audioEngine.load).toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: 'https://cdn/t1.m3u8' }));
  });

  it('statechange синхронизирует status с реальным плеером (в т.ч. remote play/pause)', async () => {
    await usePlayerStore.getState().playQueue([track('t1')], 0);

    emit('statechange', { isPlaying: false });
    expect(usePlayerStore.getState().status).toBe('paused');

    emit('statechange', { isPlaying: true });
    expect(usePlayerStore.getState().status).toBe('playing');
  });

  it('statechange не перетирает loading/error — только playing/paused', async () => {
    usePlayerStore.setState({ status: 'loading' });
    emit('statechange', { isPlaying: true });
    expect(usePlayerStore.getState().status).toBe('loading');

    usePlayerStore.setState({ status: 'error' });
    emit('statechange', { isPlaying: false });
    expect(usePlayerStore.getState().status).toBe('error');
  });
});

describe('usePlayerStore.toggleShuffle', () => {
  it('вкл: текущий трек остаётся первым, оригинальный порядок сохраняется в originalQueue', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2'), track('t3')], 1);
    const before = usePlayerStore.getState().queue;

    usePlayerStore.getState().toggleShuffle();

    const state = usePlayerStore.getState();
    expect(state.shuffle).toBe(true);
    expect(state.queueIndex).toBe(0);
    expect(state.queue[0].id).toBe('t2');
    expect(state.queue).toHaveLength(3);
    expect(state.originalQueue).toEqual(before);
  });

  it('выкл: восстанавливает исходный порядок, обнуляет originalQueue, индекс указывает на текущий трек', async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2'), track('t3')], 1);
    usePlayerStore.getState().toggleShuffle();

    usePlayerStore.getState().toggleShuffle();

    const state = usePlayerStore.getState();
    expect(state.shuffle).toBe(false);
    expect(state.originalQueue).toBeNull();
    expect(state.queue.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(state.queueIndex).toBe(1);
  });
});

describe('usePlayerStore.cycleRepeat', () => {
  it('off -> all -> one -> off', () => {
    expect(usePlayerStore.getState().repeat).toBe('off');

    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe('all');

    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe('one');

    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe('off');
  });
});

describe('usePlayerStore.next() с учётом repeat', () => {
  it("repeat='off' на последнем треке — как раньше, индекс не двигается, status paused", async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2')], 1);
    vi.clearAllMocks();

    usePlayerStore.getState().next();
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(usePlayerStore.getState().status).toBe('paused');
    expect(audioEngine.load).not.toHaveBeenCalled();
  });

  it("repeat='all' на последнем треке многотрековой очереди — переходит на индекс 0 и грузит его манифест", async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2'), track('t3')], 2);
    usePlayerStore.setState({ repeat: 'all' });
    vi.clearAllMocks();

    usePlayerStore.getState().next();
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(0);
    expect(audioEngine.load).toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: 'https://cdn/t1.m3u8' }));
  });

  it("repeat='all' с одним треком в очереди — не перезапрашивает манифест, а сикает на 0 и продолжает играть", async () => {
    await usePlayerStore.getState().playQueue([track('t1')], 0);
    usePlayerStore.setState({ repeat: 'all' });
    vi.clearAllMocks();

    usePlayerStore.getState().next();
    await flush();

    expect(request).not.toHaveBeenCalled();
    expect(audioEngine.load).not.toHaveBeenCalled();
    expect(audioEngine.seek).toHaveBeenCalledWith(0);
    expect(audioEngine.play).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().status).toBe('playing');
    expect(usePlayerStore.getState().queueIndex).toBe(0);
  });
});

describe("событие audioEngine 'ended' с учётом repeat", () => {
  it("repeat='one' — рестарт того же трека (seek+play), манифест не перезапрашивается", async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2')], 0);
    usePlayerStore.setState({ repeat: 'one' });
    vi.clearAllMocks();

    emit('ended');
    await flush();

    expect(audioEngine.seek).toHaveBeenCalledWith(0);
    expect(audioEngine.play).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
    expect(audioEngine.load).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().queueIndex).toBe(0);
    expect(usePlayerStore.getState().status).toBe('playing');
  });

  it("repeat != 'one' — обычное поведение, переход на следующий трек", async () => {
    await usePlayerStore.getState().playQueue([track('t1'), track('t2')], 0);
    vi.clearAllMocks();

    emit('ended');
    await flush();

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(audioEngine.load).toHaveBeenCalledWith(expect.objectContaining({ manifestUrl: 'https://cdn/t2.m3u8' }));
  });
});

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

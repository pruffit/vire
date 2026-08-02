// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getLocalFileMock } = vi.hoisted(() => ({ getLocalFileMock: vi.fn() }));
vi.mock('@/lib/local-files', () => ({ getLocalFile: getLocalFileMock }));

type Handler = (...args: unknown[]) => void;

class FakeAudioElement {
  currentTime = 0;
  src = '';
  volume = 1;
  listeners = new Map<string, Set<Handler>>();
  play = vi.fn(async () => {});
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();

  addEventListener(event: string, handler: Handler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  removeEventListener(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string): void {
    this.listeners.get(event)?.forEach((h) => h());
  }
}

let lastAudio: FakeAudioElement | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  lastAudio = null;
  vi.stubGlobal('Audio', vi.fn(function () {
    lastAudio = new FakeAudioElement();
    return lastAudio;
  }));
  if (!URL.createObjectURL) URL.createObjectURL = vi.fn();
  if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createLocalSource', () => {
  it('load: файл найден в реестре — ставит src и резолвится по loadedmetadata', async () => {
    getLocalFileMock.mockReturnValue(new File(['a'], 'song.mp3'));
    const { createLocalSource } = await import('./local-source');
    const engine = createLocalSource();

    const loadPromise = engine.load('local-1');
    expect(lastAudio!.src).toBe('blob:fake');
    lastAudio!.emit('loadedmetadata');
    await expect(loadPromise).resolves.toBeUndefined();
  });

  it('load: неизвестный fileId — молчаливая деградация, без throw', async () => {
    getLocalFileMock.mockReturnValue(null);
    const { createLocalSource } = await import('./local-source');
    const engine = createLocalSource();

    await expect(engine.load('missing')).resolves.toBeUndefined();
    expect(lastAudio!.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('load: ошибка декодирования файла тоже резолвит load, а не подвешивает его', async () => {
    getLocalFileMock.mockReturnValue(new File(['a'], 'broken.mp3'));
    const { createLocalSource } = await import('./local-source');
    const engine = createLocalSource();

    const loadPromise = engine.load('local-1');
    lastAudio!.emit('error');
    await expect(loadPromise).resolves.toBeUndefined();
  });

  it('play/pause/seek/currentTimeMs управляют аудио-элементом', async () => {
    getLocalFileMock.mockReturnValue(new File(['a'], 'song.mp3'));
    const { createLocalSource } = await import('./local-source');
    const engine = createLocalSource();

    engine.play();
    expect(lastAudio!.play).toHaveBeenCalledTimes(1);
    engine.pause();
    expect(lastAudio!.pause).toHaveBeenCalledTimes(1);
    engine.seek(2000);
    expect(lastAudio!.currentTime).toBe(2);
    expect(engine.currentTimeMs()).toBe(2000);
  });

  it('isBuffering: true после waiting, false после playing; onEnded/onPlaying уведомляют подписчиков', async () => {
    getLocalFileMock.mockReturnValue(new File(['a'], 'song.mp3'));
    const { createLocalSource } = await import('./local-source');
    const engine = createLocalSource();

    expect(engine.isBuffering()).toBe(false);
    lastAudio!.emit('waiting');
    expect(engine.isBuffering()).toBe(true);

    const playingListener = vi.fn();
    engine.onPlaying(playingListener);
    lastAudio!.emit('playing');
    expect(engine.isBuffering()).toBe(false);
    expect(playingListener).toHaveBeenCalledTimes(1);

    const endedListener = vi.fn();
    engine.onEnded(endedListener);
    lastAudio!.emit('ended');
    expect(endedListener).toHaveBeenCalledTimes(1);
  });

  it('destroy: освобождает object URL, снимает слушателей, обнуляет src', async () => {
    getLocalFileMock.mockReturnValue(new File(['a'], 'song.mp3'));
    const { createLocalSource } = await import('./local-source');
    const engine = createLocalSource();
    const loadPromise = engine.load('local-1');
    lastAudio!.emit('loadedmetadata');
    await loadPromise;

    engine.destroy();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(lastAudio!.pause).toHaveBeenCalled();
    expect(lastAudio!.src).toBe('');
  });

  it('destroy во время загрузки не подвешивает незавершённый load', async () => {
    getLocalFileMock.mockReturnValue(new File(['a'], 'song.mp3'));
    const { createLocalSource } = await import('./local-source');
    const engine = createLocalSource();

    const loadPromise = engine.load('local-1');
    engine.destroy();

    await expect(loadPromise).resolves.toBeUndefined();
  });
});

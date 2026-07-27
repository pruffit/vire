import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ManifestData } from '@/lib/player/manifest-cache';

const { fetchManifestMock } = vi.hoisted(() => ({ fetchManifestMock: vi.fn() }));
vi.mock('@/lib/player/manifest-cache', () => ({ fetchManifest: fetchManifestMock }));

type Handler = (...args: unknown[]) => void;

class FakeHls {
  static isSupported = vi.fn(() => true);
  static Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' } as const;

  listeners = new Map<string, Set<Handler>>();
  loadSource = vi.fn();
  attachMedia = vi.fn();
  destroy = vi.fn();

  on(event: string, handler: Handler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((handler) => handler(...args));
  }
}

let lastHlsInstance: FakeHls | null = null;
const HlsCtor = vi.fn(function () {
  lastHlsInstance = new FakeHls();
  return lastHlsInstance;
});
Object.assign(HlsCtor, { isSupported: FakeHls.isSupported, Events: FakeHls.Events });

vi.mock('hls.js', () => ({ default: HlsCtor }));

class FakeAudioElement {
  currentTime = 0;
  playbackRate = 1;
  src = '';
  paused = true;
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
  buffered: { length: number; start: (index: number) => number } = { length: 0, start: () => 0 };
  listeners = new Map<string, Set<Handler>>();

  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();
  removeAttribute = vi.fn();
  canPlayType = vi.fn(() => '');

  addEventListener(event: string, handler: Handler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  removeEventListener(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string): void {
    this.listeners.get(event)?.forEach((handler) => handler());
  }
}

let lastAudioInstance: FakeAudioElement | null = null;

async function waitForNewHls(prev: FakeHls | null): Promise<FakeHls> {
  await vi.waitFor(() => {
    if (lastHlsInstance === prev) throw new Error('hls-инстанс ещё не создан');
  });
  return lastHlsInstance!;
}

function manifest(url: string): ManifestData {
  return { hlsUrl: url, waveformPeaks: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  lastHlsInstance = null;
  lastAudioInstance = null;
  vi.stubGlobal(
    'Audio',
    vi.fn(function () {
      lastAudioInstance = new FakeAudioElement();
      return lastAudioInstance;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createJamAudio', () => {
  it('выставляет preservesPitch и вендорные варианты при создании', async () => {
    const { createJamAudio } = await import('./jam-audio');
    createJamAudio();

    expect(lastAudioInstance!.preservesPitch).toBe(true);
    expect(lastAudioInstance!.mozPreservesPitch).toBe(true);
    expect(lastAudioInstance!.webkitPreservesPitch).toBe(true);
  });

  it('load: грузит манифест, гонит через hls.js и резолвится на MANIFEST_PARSED', async () => {
    fetchManifestMock.mockResolvedValue(manifest('https://cdn.example/a.m3u8'));
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    const loadPromise = engine.load('track-a');
    const hls = await waitForNewHls(null);
    expect(hls.loadSource).toHaveBeenCalledWith('https://cdn.example/a.m3u8');
    expect(hls.attachMedia).toHaveBeenCalledWith(lastAudioInstance);

    hls.emit(FakeHls.Events.MANIFEST_PARSED);
    await expect(loadPromise).resolves.toBeUndefined();
  });

  it('load: манифест не найден — молчаливая деградация, без throw', async () => {
    fetchManifestMock.mockResolvedValue(null);
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    await expect(engine.load('missing-track')).resolves.toBeUndefined();
    expect(HlsCtor).not.toHaveBeenCalled();
  });

  it('load: fetchManifest отклоняется — молчаливая деградация', async () => {
    fetchManifestMock.mockRejectedValue(new Error('network down'));
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    await expect(engine.load('broken-track')).resolves.toBeUndefined();
  });

  it('load: фатальная ошибка hls.js резолвит загрузку и уничтожает инстанс', async () => {
    fetchManifestMock.mockResolvedValue(manifest('https://cdn.example/b.m3u8'));
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    const loadPromise = engine.load('track-b');
    const hls = await waitForNewHls(null);

    hls.emit(FakeHls.Events.ERROR, {}, { fatal: false });
    expect(hls.destroy).not.toHaveBeenCalled();

    hls.emit(FakeHls.Events.ERROR, {}, { fatal: true });
    await expect(loadPromise).resolves.toBeUndefined();
    expect(hls.destroy).toHaveBeenCalledTimes(1);
  });

  it('non-fatal bufferStalledError: прыжок на начало буферизованного диапазона и продолжение плей', async () => {
    fetchManifestMock.mockResolvedValue(manifest('https://cdn.example/stall.m3u8'));
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    const loadPromise = engine.load('track-stall');
    const hls = await waitForNewHls(null);
    hls.emit(FakeHls.Events.MANIFEST_PARSED);
    await loadPromise;

    lastAudioInstance!.currentTime = 0;
    lastAudioInstance!.buffered = { length: 1, start: () => 4.2 };

    hls.emit(FakeHls.Events.ERROR, {}, { fatal: false, details: 'bufferStalledError' });

    expect(lastAudioInstance!.currentTime).toBeCloseTo(4.21);
    expect(lastAudioInstance!.play).toHaveBeenCalled();
    expect(hls.destroy).not.toHaveBeenCalled();
  });

  it('isBuffering: true после waiting, false после playing', async () => {
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    expect(engine.isBuffering()).toBe(false);
    lastAudioInstance!.emit('waiting');
    expect(engine.isBuffering()).toBe(true);
    lastAudioInstance!.emit('playing');
    expect(engine.isBuffering()).toBe(false);
  });

  it('load: повторный вызов на новый трек уничтожает предыдущий hls-инстанс', async () => {
    fetchManifestMock.mockResolvedValue(manifest('https://cdn.example/c.m3u8'));
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    const firstLoad = engine.load('track-c');
    const firstHls = await waitForNewHls(null);
    firstHls.emit(FakeHls.Events.MANIFEST_PARSED);
    await firstLoad;

    fetchManifestMock.mockResolvedValue(manifest('https://cdn.example/d.m3u8'));
    const secondLoad = engine.load('track-d');
    expect(firstHls.destroy).toHaveBeenCalledTimes(1);
    const secondHls = await waitForNewHls(firstHls);
    secondHls.emit(FakeHls.Events.MANIFEST_PARSED);
    await secondLoad;
  });

  it('load: без нативной и hls.js поддержки не падает', async () => {
    FakeHls.isSupported.mockReturnValue(false);
    fetchManifestMock.mockResolvedValue(manifest('https://cdn.example/e.m3u8'));
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    await expect(engine.load('track-e')).resolves.toBeUndefined();
    expect(lastAudioInstance!.src).toBe('');
    FakeHls.isSupported.mockReturnValue(true);
  });

  it('play/pause/seek/setRate управляют аудио-элементом', async () => {
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    engine.play();
    expect(lastAudioInstance!.play).toHaveBeenCalledTimes(1);

    engine.pause();
    expect(lastAudioInstance!.pause).toHaveBeenCalledTimes(1);

    engine.seek(1500);
    expect(lastAudioInstance!.currentTime).toBe(1.5);
    expect(engine.currentTimeMs()).toBe(1500);

    engine.setRate(1.03);
    expect(lastAudioInstance!.playbackRate).toBe(1.03);
  });

  it('onEnded: подписчик получает событие ended, отписка снимает слушатель', async () => {
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    const listener = vi.fn();
    const unsubscribe = engine.onEnded(listener);

    lastAudioInstance!.emit('ended');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    lastAudioInstance!.emit('ended');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('destroy: снимает слушатели, уничтожает hls, обнуляет src', async () => {
    fetchManifestMock.mockResolvedValue(manifest('https://cdn.example/f.m3u8'));
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();

    const loadPromise = engine.load('track-f');
    const hlsInstance = await waitForNewHls(null);
    hlsInstance.emit(FakeHls.Events.MANIFEST_PARSED);
    await loadPromise;
    const audioInstance = lastAudioInstance!;

    const listener = vi.fn();
    engine.onEnded(listener);

    engine.destroy();

    expect(hlsInstance.destroy).toHaveBeenCalledTimes(1);
    expect(audioInstance.pause).toHaveBeenCalled();
    expect(audioInstance.src).toBe('');
    expect(audioInstance.load).toHaveBeenCalledTimes(1);

    audioInstance.emit('ended');
    expect(listener).not.toHaveBeenCalled();
  });

  it('destroy: не оставляет висящий load — вызов после destroy не бросает', async () => {
    const { createJamAudio } = await import('./jam-audio');
    const engine = createJamAudio();
    engine.destroy();

    fetchManifestMock.mockResolvedValue(null);
    await expect(engine.load('after-destroy')).resolves.toBeUndefined();
  });
});

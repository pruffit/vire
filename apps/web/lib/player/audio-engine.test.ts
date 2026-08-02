// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PlayerTrack } from '@/store/player';

const { fetchManifestMock } = vi.hoisted(() => ({ fetchManifestMock: vi.fn() }));
vi.mock('@/lib/player/manifest-cache', () => ({ fetchManifest: fetchManifestMock }));

const { getLocalFileMock } = vi.hoisted(() => ({ getLocalFileMock: vi.fn() }));
vi.mock('@/lib/local-files', () => ({ getLocalFile: getLocalFileMock }));

const { getSessionIdMock } = vi.hoisted(() => ({ getSessionIdMock: vi.fn() }));
vi.mock('@/lib/session-id', () => ({ getSessionId: getSessionIdMock }));

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

  once(event: string, handler: Handler): void {
    const wrapped: Handler = (...args) => {
      this.off(event, wrapped);
      handler(...args);
    };
    this.on(event, wrapped);
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
  duration = NaN;
  src = '';
  volume = 1;
  listeners = new Map<string, Set<Handler>>();

  play = vi.fn(async () => {});
  pause = vi.fn();
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
    this.listeners.get(event)?.forEach((h) => h());
  }
}

let lastAudioInstance: FakeAudioElement | null = null;
let fetchGlobalMock: ReturnType<typeof vi.fn>;

function localPlayerTrack(id: string): PlayerTrack {
  return { id, title: `title-${id}`, artistName: '', coverUrl: null, localFileId: id };
}

function catalogPlayerTrack(id: string): PlayerTrack {
  return { id, title: `title-${id}`, artistName: 'Artist', coverUrl: null };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  lastAudioInstance = null;
  lastHlsInstance = null;

  vi.stubGlobal(
    'Audio',
    vi.fn(function () {
      lastAudioInstance = new FakeAudioElement();
      return lastAudioInstance;
    }),
  );

  fetchGlobalMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchGlobalMock);

  if (!URL.createObjectURL) URL.createObjectURL = vi.fn();
  if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  getSessionIdMock.mockResolvedValue('sid-test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('audio-engine: локальные файлы', () => {
  it('манифест не запрашивается, hls.js не поднимается', async () => {
    getLocalFileMock.mockReturnValue(new File(['a'], 'song.mp3'));
    const { controls } = await import('./audio-engine');

    controls.playQueue([localPlayerTrack('local-1')], { context: { source: 'direct' } });

    expect(fetchManifestMock).not.toHaveBeenCalled();
    expect(HlsCtor).not.toHaveBeenCalled();
    expect(lastAudioInstance!.src).toBe('blob:fake');
  });

  it('playing на локальном треке не шлёт heartbeat и play-event', async () => {
    getLocalFileMock.mockReturnValue(new File(['a'], 'song.mp3'));
    const { controls } = await import('./audio-engine');

    controls.playQueue([localPlayerTrack('local-1')], { context: { source: 'direct' } });
    lastAudioInstance!.emit('playing');

    const trackingCalls = fetchGlobalMock.mock.calls.filter(([url]) => {
      return typeof url === 'string' && (url.includes('/listening') || url.includes('/play'));
    });
    expect(trackingCalls).toHaveLength(0);
  });

  it('файла нет в реестре — audioError, плеер не зависает', async () => {
    getLocalFileMock.mockReturnValue(null);
    const { usePlayerStore } = await import('@/store/player');
    const { controls } = await import('./audio-engine');

    controls.playQueue([localPlayerTrack('local-missing')], { context: { source: 'direct' } });

    expect(usePlayerStore.getState().audioError).toBe(true);
    expect(usePlayerStore.getState().isLoading).toBe(false);
    expect(usePlayerStore.getState().hasAudio).toBe(false);
    expect(fetchManifestMock).not.toHaveBeenCalled();
  });

  it('файла нет в реестре — переходит к следующему каталожному треку', async () => {
    getLocalFileMock.mockReturnValue(null);
    fetchManifestMock.mockResolvedValue({ hlsUrl: 'https://cdn.example/a.m3u8', waveformPeaks: null });
    const { usePlayerStore } = await import('@/store/player');
    const { controls } = await import('./audio-engine');

    controls.playQueue([localPlayerTrack('local-missing'), catalogPlayerTrack('catalog-1')], {
      context: { source: 'direct' },
    });

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(usePlayerStore.getState().track?.id).toBe('catalog-1');

    await new Promise((r) => setTimeout(r, 0));
  });

  it('object URL освобождается при переходе к следующему локальному файлу', async () => {
    const fileA = new File(['a'], 'a.mp3');
    const fileB = new File(['b'], 'b.mp3');
    getLocalFileMock.mockImplementation((id: string) => (id === 'local-a' ? fileA : id === 'local-b' ? fileB : null));
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:a').mockReturnValueOnce('blob:b');

    const { controls } = await import('./audio-engine');
    const tracks = [localPlayerTrack('local-a'), localPlayerTrack('local-b')];

    controls.playQueue(tracks, { startIndex: 0, context: { source: 'direct' } });
    expect(lastAudioInstance!.src).toBe('blob:a');

    controls.playQueue(tracks, { startIndex: 1, context: { source: 'direct' } });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a');
    expect(lastAudioInstance!.src).toBe('blob:b');
  });

  it('durationchange от <audio> обновляет duration в сторе (длительность берётся из элемента, не из реестра)', async () => {
    getLocalFileMock.mockReturnValue(new File(['a'], 'song.mp3'));
    const { usePlayerStore } = await import('@/store/player');
    const { controls } = await import('./audio-engine');

    controls.playQueue([localPlayerTrack('local-1')], { context: { source: 'direct' } });
    lastAudioInstance!.duration = 187;
    lastAudioInstance!.emit('durationchange');

    expect(usePlayerStore.getState().duration).toBe(187);
  });

  it('волна не растёт, пока текущий трек локальный', async () => {
    getLocalFileMock.mockReturnValue(new File(['a'], 'song.mp3'));
    const { usePlayerStore } = await import('@/store/player');
    const { controls } = await import('./audio-engine');

    controls.playQueue([localPlayerTrack('local-1')], { context: { source: 'wave' } });
    usePlayerStore.getState()._setState({ waveMode: true });

    await controls.next();

    const waveCalls = fetchGlobalMock.mock.calls.filter(([url]) => typeof url === 'string' && url.includes('/api/v1/wave'));
    expect(waveCalls).toHaveLength(0);
    expect(usePlayerStore.getState().isLoading).toBe(false);
  });
});

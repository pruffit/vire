// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlayerTrack } from '@/store/player';

const { togglePlayMock, nextMock, prevMock } = vi.hoisted(() => ({
  togglePlayMock: vi.fn(),
  nextMock: vi.fn(async () => {}),
  prevMock: vi.fn(),
}));
vi.mock('@/lib/player/audio-engine', () => ({
  controls: { togglePlay: togglePlayMock, next: nextMock, prev: prevMock },
}));

function track(id: string): PlayerTrack {
  return { id, title: `title-${id}`, artistName: 'artist', coverUrl: null };
}

describe('initMediaSession', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('не падает и ничего не делает без поддержки mediaSession в navigator', async () => {
    const { usePlayerStore } = await import('@/store/player');
    usePlayerStore.getState()._setState({ track: null, isPlaying: false });
    const { initMediaSession } = await import('./media-session');
    expect(() => initMediaSession()).not.toThrow();
  });

  it('регистрирует action handlers и синкает playbackState/metadata на изменения store', async () => {
    const setActionHandler = vi.fn();
    let playbackState = 'none';
    let metadata: MediaMetadata | null = null;
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      mediaSession: {
        setActionHandler,
        set playbackState(v: string) {
          playbackState = v;
        },
        get playbackState() {
          return playbackState;
        },
        set metadata(v: MediaMetadata | null) {
          metadata = v;
        },
        get metadata() {
          return metadata;
        },
      },
    });
    vi.stubGlobal('MediaMetadata', function (this: Record<string, unknown>, init: Record<string, unknown>) {
      Object.assign(this, init);
    });

    const { usePlayerStore } = await import('@/store/player');
    usePlayerStore.getState()._setState({ track: null, isPlaying: false });
    const { initMediaSession } = await import('./media-session');

    initMediaSession();

    expect(setActionHandler).toHaveBeenCalledWith('play', expect.any(Function));
    expect(setActionHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(setActionHandler).toHaveBeenCalledWith('previoustrack', expect.any(Function));
    expect(setActionHandler).toHaveBeenCalledWith('nexttrack', expect.any(Function));
    expect(playbackState).toBe('none');

    usePlayerStore.getState()._setState({ track: track('a'), isPlaying: true });
    expect(playbackState).toBe('playing');
    expect((metadata as unknown as { title: string } | null)?.title).toBe('title-a');

    usePlayerStore.getState()._setState({ isPlaying: false });
    expect(playbackState).toBe('paused');

    const playHandler = setActionHandler.mock.calls.find((c) => c[0] === 'play')?.[1] as () => void;
    playHandler();
    expect(togglePlayMock).toHaveBeenCalledTimes(1);

    const nextHandler = setActionHandler.mock.calls.find((c) => c[0] === 'nexttrack')?.[1] as () => void;
    nextHandler();
    expect(nextMock).toHaveBeenCalledTimes(1);

    const prevHandler = setActionHandler.mock.calls.find((c) => c[0] === 'previoustrack')?.[1] as () => void;
    prevHandler();
    expect(prevMock).toHaveBeenCalledTimes(1);
  });
});

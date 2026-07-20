// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { JamQueueItem } from '@vire/core';
import { useJamQueue } from './use-jam-queue';

vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

function track(id: string): JamQueueItem {
  return {
    id, trackId: `t-${id}`, position: 0, addedByParticipantId: null, addedAt: new Date('2026-07-20T12:00:00Z'),
    title: id, durationSec: null, artistName: 'Artist', artistSlug: 'artist', releaseId: 'release-1',
    coverUrl: null, accentColor: null, isExplicit: false, version: null, feat: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
});

describe('useJamQueue', () => {
  it('отражает серверную очередь, пока оверлея нет', () => {
    const { result } = renderHook(() => useJamQueue({ code: 'A2B3C4', sessionId: null, serverQueue: [track('a')], setDragging: vi.fn() }));
    expect(result.current.queue.map((t) => t.id)).toEqual(['a']);
  });

  it('moveTrack переставляет локально сразу, снимает dragging и шлёт move-интент', async () => {
    const setDragging = vi.fn();
    const serverQueue = [track('a'), track('b')];
    const { result } = renderHook(() => useJamQueue({ code: 'A2B3C4', sessionId: null, serverQueue, setDragging }));

    let p: Promise<void> = Promise.resolve();
    act(() => {
      p = result.current.moveTrack('a', 'b');
    });

    expect(result.current.queue.map((t) => t.id)).toEqual(['b', 'a']);
    expect(setDragging).toHaveBeenCalledWith(false);

    await act(() => p);

    expect(fetch).toHaveBeenCalledWith('/api/v1/jam/A2B3C4/queue', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ kind: 'move', itemId: 'a', toPosition: 1 }),
    }));
  });

  it('moveTrack откатывает порядок при сетевой ошибке', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    const serverQueue = [track('a'), track('b')];
    const { result } = renderHook(() => useJamQueue({ code: 'A2B3C4', sessionId: null, serverQueue, setDragging: vi.fn() }));

    await act(() => result.current.moveTrack('a', 'b'));

    expect(result.current.queue.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('addTrack добавляет элемент сразу и включает sessionId гостя в тело запроса', async () => {
    const serverQueue = [track('a')];
    const { result } = renderHook(() => useJamQueue({ code: 'A2B3C4', sessionId: 'guest-1.sig', serverQueue, setDragging: vi.fn() }));

    let p: Promise<void> = Promise.resolve();
    act(() => {
      p = result.current.addTrack(track('new'));
    });
    expect(result.current.queue.map((t) => t.id)).toEqual(['a', 'new']);

    await act(() => p);
    expect(fetch).toHaveBeenCalledWith('/api/v1/jam/A2B3C4/queue', expect.objectContaining({
      body: JSON.stringify({ kind: 'add', trackId: 't-new', sessionId: 'guest-1.sig' }),
    }));
  });

  it('addTrack откатывает добавление при сетевой ошибке', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    const serverQueue = [track('a')];
    const { result } = renderHook(() => useJamQueue({ code: 'A2B3C4', sessionId: null, serverQueue, setDragging: vi.fn() }));

    await act(() => result.current.addTrack(track('new')));

    expect(result.current.queue.map((t) => t.id)).toEqual(['a']);
  });

  it('removeTrack убирает элемент сразу и откатывает при ошибке', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    const serverQueue = [track('a'), track('b')];
    const { result } = renderHook(() => useJamQueue({ code: 'A2B3C4', sessionId: null, serverQueue, setDragging: vi.fn() }));

    let p: Promise<void> = Promise.resolve();
    act(() => {
      p = result.current.removeTrack('a');
    });
    expect(result.current.queue.map((t) => t.id)).toEqual(['b']);

    await act(() => p);
    expect(result.current.queue.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('shuffleQueue шлёт kind:shuffle и оставляет тот же набор id локально', async () => {
    const serverQueue = [track('a'), track('b'), track('c')];
    const { result } = renderHook(() => useJamQueue({ code: 'A2B3C4', sessionId: null, serverQueue, setDragging: vi.fn() }));

    await act(() => result.current.shuffleQueue());

    expect(fetch).toHaveBeenCalledWith('/api/v1/jam/A2B3C4/queue', expect.objectContaining({
      body: JSON.stringify({ kind: 'shuffle' }),
    }));
    expect(result.current.queue.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('shuffleQueue откатывает локальный порядок при сетевой ошибке', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    const serverQueue = [track('a'), track('b')];
    const { result } = renderHook(() => useJamQueue({ code: 'A2B3C4', sessionId: null, serverQueue, setDragging: vi.fn() }));

    await act(() => result.current.shuffleQueue());

    expect(result.current.queue.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('сбрасывает оверлей, когда приходит свежая серверная очередь', () => {
    const { result, rerender } = renderHook(
      ({ serverQueue }: { serverQueue: JamQueueItem[] }) => useJamQueue({ code: 'A2B3C4', sessionId: null, serverQueue, setDragging: vi.fn() }),
      { initialProps: { serverQueue: [track('a')] } },
    );

    act(() => {
      void result.current.addTrack(track('optimistic'));
    });
    expect(result.current.queue.map((t) => t.id)).toEqual(['a', 'optimistic']);

    rerender({ serverQueue: [track('a'), track('confirmed')] });
    expect(result.current.queue.map((t) => t.id)).toEqual(['a', 'confirmed']);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { JamQueueItem } from '@vire/core';

const { useRealtimeMock } = vi.hoisted(() => ({ useRealtimeMock: vi.fn() }));

vi.mock('@/lib/use-realtime', () => ({ useRealtime: useRealtimeMock }));

import { useJamRoom } from './use-jam-room';

function lastHandlers() {
  const call = useRealtimeMock.mock.calls.at(-1) as [string, Record<string, (e: Record<string, unknown>) => void>];
  return call[1];
}

function track(id: string): JamQueueItem {
  return {
    id,
    trackId: `t-${id}`,
    position: 0,
    addedByParticipantId: null,
    addedAt: new Date('2026-07-20T12:00:00Z'),
    title: id,
    durationSec: null,
    artistName: 'Artist',
    artistSlug: 'artist',
    releaseId: 'release-1',
    coverUrl: null,
    accentColor: null,
    isExplicit: false,
    version: null,
    feat: [],
  };
}

beforeEach(() => vi.clearAllMocks());

describe('useJamRoom', () => {
  it('строит URL стрима из кода и sessionId гостя', () => {
    renderHook(() => useJamRoom('A2B3C4', 'guest-1.sig'));

    expect(useRealtimeMock).toHaveBeenCalledWith('/api/v1/jam/A2B3C4/stream?sessionId=guest-1.sig', expect.any(Object));
  });

  it('опускает sessionId в URL, когда идентичность ещё не разрешена', () => {
    renderHook(() => useJamRoom('A2B3C4', null));

    expect(useRealtimeMock).toHaveBeenCalledWith('/api/v1/jam/A2B3C4/stream', expect.any(Object));
  });

  it('применяет снапшот и помечает соединение установленным', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));

    act(() => {
      lastHandlers()['jam:snapshot']!({ session: {}, participants: [], queue: [track('a')], version: 5, playback: null });
    });

    expect(result.current.queue.map((t) => t.id)).toEqual(['a']);
    expect(result.current.version).toBe(5);
    expect(result.current.connected).toBe(true);
  });

  it('игнорирует jam:queue с версией не новее текущей', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));
    act(() => {
      lastHandlers()['jam:snapshot']!({ session: {}, participants: [], queue: [track('a')], version: 5, playback: null });
    });

    act(() => {
      lastHandlers()['jam:queue']!({ queue: [track('b')], version: 5 });
    });

    expect(result.current.queue.map((t) => t.id)).toEqual(['a']);
    expect(result.current.version).toBe(5);
  });

  it('применяет jam:queue с более новой версией', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));
    act(() => {
      lastHandlers()['jam:snapshot']!({ session: {}, participants: [], queue: [track('a')], version: 5, playback: null });
    });

    act(() => {
      lastHandlers()['jam:queue']!({ queue: [track('b')], version: 6 });
    });

    expect(result.current.queue.map((t) => t.id)).toEqual(['b']);
    expect(result.current.version).toBe(6);
  });

  it('буферизует jam:queue во время drag и применяет его по отпусканию', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));
    act(() => {
      lastHandlers()['jam:snapshot']!({ session: {}, participants: [], queue: [track('a')], version: 5, playback: null });
    });

    act(() => result.current.setDragging(true));
    act(() => {
      lastHandlers()['jam:queue']!({ queue: [track('b')], version: 6 });
    });
    expect(result.current.queue.map((t) => t.id)).toEqual(['a']);

    act(() => result.current.setDragging(false));
    expect(result.current.queue.map((t) => t.id)).toEqual(['b']);
    expect(result.current.version).toBe(6);
  });

  it('не откатывает более свежее состояние буфером, устаревшим к моменту отпускания', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));
    act(() => {
      lastHandlers()['jam:snapshot']!({ session: {}, participants: [], queue: [track('a')], version: 5, playback: null });
    });

    act(() => result.current.setDragging(true));
    act(() => {
      lastHandlers()['jam:queue']!({ queue: [track('b')], version: 6 });
    });
    act(() => {
      lastHandlers()['jam:snapshot']!({ session: {}, participants: [], queue: [track('c')], version: 7, playback: null });
    });

    act(() => result.current.setDragging(false));

    expect(result.current.queue.map((t) => t.id)).toEqual(['c']);
    expect(result.current.version).toBe(7);
  });

  it('отражает jam:ended в состоянии', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));

    act(() => {
      lastHandlers()['jam:ended']!({});
    });

    expect(result.current.ended).toBe(true);
  });
});

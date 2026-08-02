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
    source: 'VIRE',
    trackId: `t-${id}`,
    externalId: null,
    externalUrl: null,
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
      lastHandlers()['jam:snapshot']!({
        session: {}, participants: [], queue: [track('a')], version: 5, playback: null, presentParticipantIds: ['p1'],
      });
    });

    expect(result.current.queue.map((t) => t.id)).toEqual(['a']);
    expect(result.current.version).toBe(5);
    expect(result.current.connected).toBe(true);
    expect(result.current.mode).toBe('SYNCED');
    expect(result.current.speakerParticipantId).toBeNull();
    expect(result.current.presentParticipantIds).toEqual(['p1']);
  });

  it('снапшот без presentParticipantIds по умолчанию даёт пустой список', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));

    act(() => {
      lastHandlers()['jam:snapshot']!({ session: {}, participants: [], queue: [], version: 1, playback: null });
    });

    expect(result.current.presentParticipantIds).toEqual([]);
  });

  it('снапшот завершённого джема сразу помечает комнату завершённой', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));

    act(() => {
      lastHandlers()['jam:snapshot']!({
        session: { status: 'ENDED' }, participants: [], queue: [], version: 1, playback: null,
      });
    });

    expect(result.current.ended).toBe(true);
  });

  it('снапшот живого джема снимает признак завершения', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));

    act(() => {
      lastHandlers()['jam:ended']!({ type: 'jam:ended' });
    });
    expect(result.current.ended).toBe(true);

    act(() => {
      lastHandlers()['jam:snapshot']!({
        session: { status: 'LIVE' }, participants: [], queue: [], version: 2, playback: null,
      });
    });

    expect(result.current.ended).toBe(false);
  });

  it('применяет jam:presence к текущему состоянию', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));
    act(() => {
      lastHandlers()['jam:snapshot']!({
        session: {}, participants: [], queue: [track('a')], version: 5, playback: null, presentParticipantIds: ['p1'],
      });
    });

    act(() => {
      lastHandlers()['jam:presence']!({ participantIds: ['p1', 'p2'] });
    });

    expect(result.current.presentParticipantIds).toEqual(['p1', 'p2']);
    expect(result.current.queue.map((t) => t.id)).toEqual(['a']);
  });

  it('берёт режим и колонку из session в снапшоте', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));

    act(() => {
      lastHandlers()['jam:snapshot']!({
        session: { mode: 'SPEAKER', speakerParticipantId: 'p-1' },
        participants: [],
        queue: [],
        version: 1,
        playback: null,
      });
    });

    expect(result.current.mode).toBe('SPEAKER');
    expect(result.current.speakerParticipantId).toBe('p-1');
  });

  it('применяет jam:session к текущему состоянию', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));
    act(() => {
      lastHandlers()['jam:snapshot']!({ session: {}, participants: [], queue: [track('a')], version: 5, playback: null });
    });

    act(() => {
      lastHandlers()['jam:session']!({ mode: 'SPEAKER', speakerParticipantId: 'p-2' });
    });

    expect(result.current.mode).toBe('SPEAKER');
    expect(result.current.speakerParticipantId).toBe('p-2');
    expect(result.current.queue.map((t) => t.id)).toEqual(['a']);
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

  it('применяет jam:skip к состоянию', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));
    act(() => {
      lastHandlers()['jam:snapshot']!({
        session: {}, participants: [], queue: [track('a')], version: 5,
        playback: { itemId: 'a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 },
      });
    });

    act(() => {
      lastHandlers()['jam:skip']!({ itemId: 'a', votes: 1, needed: 2 });
    });

    expect(result.current.skipVotes).toEqual({ itemId: 'a', votes: 1, needed: 2 });
  });

  it('jam:playback на смену itemId сбрасывает skipVotes прежней позиции', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));
    act(() => {
      lastHandlers()['jam:snapshot']!({
        session: {}, participants: [], queue: [track('a'), track('b')], version: 5,
        playback: { itemId: 'a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 },
      });
      lastHandlers()['jam:skip']!({ itemId: 'a', votes: 1, needed: 2 });
    });
    expect(result.current.skipVotes).not.toBeNull();

    act(() => {
      lastHandlers()['jam:playback']!({ playback: { itemId: 'b', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 2 } });
    });

    expect(result.current.skipVotes).toBeNull();
  });

  it('jam:playback на той же позиции (пауза/сик) не трогает skipVotes', () => {
    const { result } = renderHook(() => useJamRoom('A2B3C4', null));
    act(() => {
      lastHandlers()['jam:snapshot']!({
        session: {}, participants: [], queue: [track('a')], version: 5,
        playback: { itemId: 'a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 },
      });
      lastHandlers()['jam:skip']!({ itemId: 'a', votes: 1, needed: 2 });
    });

    act(() => {
      lastHandlers()['jam:playback']!({ playback: { itemId: 'a', startedAtMs: 0, paused: true, pausedPositionMs: 1000, version: 2 } });
    });

    expect(result.current.skipVotes).toEqual({ itemId: 'a', votes: 1, needed: 2 });
  });
});

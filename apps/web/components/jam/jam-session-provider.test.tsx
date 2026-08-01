// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { JamParticipant, JamPlaybackState, JamQueueItem } from '@vire/core';

const { useJamRoomMock, useServerClockMock, usePlaybackSyncMock, toastMock } = vi.hoisted(() => ({
  useJamRoomMock: vi.fn(),
  useServerClockMock: vi.fn(),
  usePlaybackSyncMock: vi.fn(),
  toastMock: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock('@/lib/jam/use-jam-room', () => ({ useJamRoom: useJamRoomMock }));
vi.mock('@/lib/jam/server-clock', () => ({ useServerClock: useServerClockMock }));
vi.mock('@/lib/jam/use-playback-sync', () => ({ usePlaybackSync: usePlaybackSyncMock }));
vi.mock('@/lib/toast', () => ({ toast: toastMock }));

import { JamSessionProvider } from './jam-session-provider';
import { useJamStore, type ActiveJam } from '@/store/jam';
import { usePlayerStore } from '@/store/player';
import { getJamTransport } from '@/lib/jam/jam-controls';

interface RoomState {
  queue: JamQueueItem[];
  version: number;
  participants: JamParticipant[];
  playback: JamPlaybackState | null;
  mode: 'SYNCED' | 'SPEAKER';
  speakerParticipantId: string | null;
  presentParticipantIds: string[];
  connected: boolean;
  ended: boolean;
  setDragging: ReturnType<typeof vi.fn>;
}

function baseRoom(overrides?: Partial<RoomState>): RoomState {
  return {
    queue: [], version: 0, participants: [], playback: null, mode: 'SYNCED', speakerParticipantId: null,
    presentParticipantIds: [], connected: true, ended: false, setDragging: vi.fn(),
    ...overrides,
  };
}

function track(id: string): JamQueueItem {
  return {
    id,
    trackId: `t-${id}`,
    position: 0,
    addedByParticipantId: null,
    addedAt: new Date('2026-07-20T12:00:00Z'),
    title: id,
    durationSec: 200,
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

const jam: ActiveJam = { code: 'A2B3C4', participantId: 'p1', role: 'HOST', sessionId: null };

function Harness({ showPage }: { showPage: boolean }) {
  return (
    <JamSessionProvider>
      {showPage ? <div data-testid="page">page</div> : <div data-testid="empty" />}
    </JamSessionProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useServerClockMock.mockReturnValue({ offsetMs: 0, serverNow: () => 0 });
  useJamRoomMock.mockReturnValue(baseRoom());
  useJamStore.setState({ active: null, audioEnabled: false });
  usePlayerStore.setState({ jamOverride: null });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as unknown as Response));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('JamSessionProvider: регресс — уход со страницы не убивает джем', () => {
  it('размонтирование дочерней страницы не чистит jamOverride и транспорт — они живут в сторе, не на странице', async () => {
    const queue = [track('a'), track('b')];
    useJamRoomMock.mockReturnValue(baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 } }));

    const { rerender } = render(<Harness showPage />);
    act(() => useJamStore.getState().activate(jam));

    await waitFor(() => expect(usePlayerStore.getState().jamOverride).not.toBeNull());
    expect(getJamTransport()).not.toBeNull();

    rerender(<Harness showPage={false} />);

    expect(usePlayerStore.getState().jamOverride).not.toBeNull();
    expect(usePlayerStore.getState().jamOverride?.code).toBe('A2B3C4');
    expect(getJamTransport()).not.toBeNull();
  });
});

describe('JamSessionProvider: протухшая запись джема', () => {
  it('4xx на проверке членства чистит стор — иначе EventSource ретраит вечно', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 } as unknown as Response));
    useJamStore.setState({ active: jam, audioEnabled: true });

    render(<Harness showPage />);

    await waitFor(() => expect(useJamStore.getState().active).toBeNull());
  });

  it('сетевая ошибка проверки не выкидывает из джема — офлайн не повод рвать сессию', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    useJamStore.setState({ active: jam, audioEnabled: true });

    render(<Harness showPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(useJamStore.getState().active).not.toBeNull();
  });
});

describe('JamSessionProvider: завершение и восстановление после F5', () => {
  it('jam:ended (room.ended) чистит стор и показывает тост', async () => {
    const queue = [track('a')];
    useJamRoomMock.mockReturnValue(baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 } }));

    render(<Harness showPage />);
    act(() => useJamStore.getState().activate(jam));
    await waitFor(() => expect(usePlayerStore.getState().jamOverride).not.toBeNull());

    useJamRoomMock.mockReturnValue(baseRoom({ queue, ended: true }));
    // useJamRoom замокан — сам он не триггерит ре-рендер на новый ended, как это сделал бы
    // реальный SSE-коллбэк; форсируем его новой ссылкой active (контент тот же).
    useJamStore.setState({ active: { ...jam } });

    await waitFor(() => expect(useJamStore.getState().active).toBeNull());
    expect(toastMock).toHaveBeenCalledWith('Джем завершён');
  });

  it('после F5 (active восстановлен из persist, audioEnabled=false) override приходит с needsAudioGesture:true', async () => {
    const queue = [track('a')];
    useJamRoomMock.mockReturnValue(baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 } }));
    useJamStore.setState({ active: jam, audioEnabled: false });

    render(<Harness showPage />);

    await waitFor(() => expect(usePlayerStore.getState().jamOverride).not.toBeNull());
    expect(usePlayerStore.getState().jamOverride?.needsAudioGesture).toBe(true);
  });

  it('когда audioEnabled=true, needsAudioGesture:false', async () => {
    const queue = [track('a')];
    useJamRoomMock.mockReturnValue(baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 } }));

    render(<Harness showPage />);
    act(() => useJamStore.getState().activate(jam));

    await waitFor(() => expect(usePlayerStore.getState().jamOverride?.needsAudioGesture).toBe(false));
  });
});

describe('JamSessionProvider: переход трека', () => {
  it('хост на завершении трека переводит очередь на следующий', async () => {
    const queue = [track('a'), track('b')];
    useJamRoomMock.mockReturnValue(baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 } }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    render(<Harness showPage />);
    act(() => useJamStore.getState().activate({ ...jam, role: 'HOST' }));
    await waitFor(() => expect(usePlaybackSyncMock).toHaveBeenCalled());

    const onEnded = usePlaybackSyncMock.mock.calls.at(-1)![0].onEnded as () => void;
    act(() => onEnded());

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/playback'));
      expect(call).toBeTruthy();
      expect(call![1]!.body).toBe(JSON.stringify({ kind: 'track', trackId: 't-b' }));
    });
  });

  it('гость на завершении трека ничего не шлёт', async () => {
    const queue = [track('a'), track('b')];
    useJamRoomMock.mockReturnValue(baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 } }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    render(<Harness showPage />);
    act(() => useJamStore.getState().activate({ ...jam, role: 'GUEST' }));
    await waitFor(() => expect(usePlaybackSyncMock).toHaveBeenCalled());

    const onEnded = usePlaybackSyncMock.mock.calls.at(-1)![0].onEnded as () => void;
    act(() => onEnded());

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/playback'))).toBe(false);
  });
});

describe('JamSessionProvider: SPEAKER/SYNCED флаги для usePlaybackSync', () => {
  it('SPEAKER: пульт (не звуковое устройство) — audioEnabled:false, driftCorrection:false', async () => {
    useJamRoomMock.mockReturnValue(baseRoom({
      mode: 'SPEAKER',
      speakerParticipantId: 'someone-else',
    }));

    render(<Harness showPage />);
    act(() => useJamStore.getState().activate({ ...jam, participantId: 'p1', role: 'GUEST' }));

    await waitFor(() => expect(usePlaybackSyncMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ audioEnabled: false, driftCorrection: false }),
    ));
  });

  it('SYNCED: единственное живое устройство — driftCorrection:false', async () => {
    useJamRoomMock.mockReturnValue(baseRoom({ presentParticipantIds: ['p1'] }));

    render(<Harness showPage />);
    act(() => useJamStore.getState().activate(jam));

    await waitFor(() => expect(usePlaybackSyncMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ driftCorrection: false }),
    ));
  });

  it('SYNCED: два живых устройства — driftCorrection:true', async () => {
    useJamRoomMock.mockReturnValue(baseRoom({ presentParticipantIds: ['p1', 'p2'] }));

    render(<Harness showPage />);
    act(() => useJamStore.getState().activate(jam));

    await waitFor(() => expect(usePlaybackSyncMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ driftCorrection: true }),
    ));
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JamParticipant, JamPlaybackState, JamQueueItem } from '@vire/core';

const { useJamRoomMock, getSessionIdMock, useServerClockMock, usePlaybackSyncMock, controlsPauseMock } = vi.hoisted(() => ({
  useJamRoomMock: vi.fn(),
  getSessionIdMock: vi.fn(),
  useServerClockMock: vi.fn(),
  usePlaybackSyncMock: vi.fn(),
  controlsPauseMock: vi.fn(),
}));

vi.mock('@/lib/jam/use-jam-room', () => ({ useJamRoom: useJamRoomMock }));
vi.mock('@/lib/jam/server-clock', () => ({ useServerClock: useServerClockMock }));
vi.mock('@/lib/jam/use-playback-sync', () => ({ usePlaybackSync: usePlaybackSyncMock }));
vi.mock('@/lib/player/audio-engine', () => ({ controls: { pause: controlsPauseMock } }));
vi.mock('@/lib/session-id', () => ({ getSessionId: getSessionIdMock }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

// motion в jsdom не завершает exit-анимации — рендерим без них, unmount становится синхронным
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const C = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
          const dom = Object.fromEntries(
            Object.entries(props).filter(
              ([k]) => !['initial', 'animate', 'exit', 'transition', 'whileTap', 'whileHover', 'layoutId'].includes(k),
            ),
          );
          const Tag = tag as 'div';
          return <Tag {...dom}>{children}</Tag>;
        };
        C.displayName = `motion.${tag}`;
        return C;
      },
    },
  ),
}));

import { usePlayerStore as usePlayerStoreForTest } from '@/store/player';
import { JamRoom } from './jam-room';

interface RoomState {
  queue: JamQueueItem[];
  version: number;
  participants: JamParticipant[];
  playback: JamPlaybackState | null;
  connected: boolean;
  ended: boolean;
  setDragging: ReturnType<typeof vi.fn>;
}

function baseRoom(overrides?: Partial<RoomState>): RoomState {
  return {
    queue: [], version: 0, participants: [], playback: null, connected: true, ended: false, setDragging: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  getSessionIdMock.mockResolvedValue('guest-1.sig');
  useJamRoomMock.mockReturnValue(baseRoom());
  useServerClockMock.mockReturnValue({ offsetMs: 0, serverNow: () => 0 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function joinAs(role: 'HOST' | 'GUEST') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ participant: { id: 'p1', role } }) } as unknown as Response),
  );
  fireEvent.click(screen.getByText('Подключиться к звуку'));
  await waitFor(() => expect(screen.queryByText('Подключиться к звуку')).toBeNull());
}

describe('JamRoom', () => {
  it('экран входа показывает название и хоста; после входа гость видит пустую очередь и не видит контролов хоста', async () => {
    render(
      <JamRoom code="A2B3C4" title="Пятничный джем" hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );

    expect(screen.getByText('Пятничный джем')).toBeTruthy();
    expect(screen.getByText('Хост — Danya')).toBeTruthy();

    await joinAs('GUEST');

    expect(screen.getByText('Очередь пуста')).toBeTruthy();
    expect(screen.queryByText('Завершить джем')).toBeNull();
  });

  it('хост видит кнопку завершения джема', async () => {
    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );

    await joinAs('HOST');

    expect(screen.getByText('Завершить джем')).toBeTruthy();
  });

  it('уже завершённый джем показывает финальный экран без возможности войти', () => {
    render(
      <JamRoom code="A2B3C4" title="Party" hostDisplayName="Danya" initialEnded isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );

    expect(screen.getByText('Джем завершён')).toBeTruthy();
    expect(screen.queryByText('Подключиться к звуку')).toBeNull();
  });

  it('до входа звук синхронизации выключен; после входа глушит глобальный плеер и включает его', async () => {
    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );

    expect(usePlaybackSyncMock).toHaveBeenLastCalledWith(expect.objectContaining({ audioEnabled: false }));
    expect(controlsPauseMock).not.toHaveBeenCalled();

    await joinAs('GUEST');

    expect(controlsPauseMock).toHaveBeenCalledTimes(1);
    expect(usePlaybackSyncMock).toHaveBeenLastCalledWith(expect.objectContaining({ audioEnabled: true }));
  });

  it('хост на завершении трека переводит очередь на следующий; гость ничего не шлёт', async () => {
    const queue = [track('a'), track('b')];
    useJamRoomMock.mockReturnValue(
      baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 } }),
    );
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes('/join')) return { ok: true, json: async () => ({ participant: { id: 'p1', role: 'HOST' } }) };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );
    fireEvent.click(screen.getByText('Подключиться к звуку'));
    await waitFor(() => expect(screen.queryByText('Подключиться к звуку')).toBeNull());

    const onEnded = usePlaybackSyncMock.mock.calls.at(-1)![0].onEnded as () => void;
    onEnded();

    await waitFor(() => {
      const playbackCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/playback'));
      expect(playbackCall).toBeTruthy();
      expect(playbackCall![1]!.body).toBe(JSON.stringify({ kind: 'track', trackId: 't-b' }));
    });
  });

  it('гость на завершении трека не шлёт следующий трек', async () => {
    const queue = [track('a'), track('b')];
    useJamRoomMock.mockReturnValue(
      baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 } }),
    );
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes('/join')) return { ok: true, json: async () => ({ participant: { id: 'p1', role: 'GUEST' } }) };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );
    fireEvent.click(screen.getByText('Подключиться к звуку'));
    await waitFor(() => expect(screen.queryByText('Подключиться к звуку')).toBeNull());

    const onEnded = usePlaybackSyncMock.mock.calls.at(-1)![0].onEnded as () => void;
    onEnded();

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/playback'))).toBe(false);
  });

  it('хост кликает трек в очереди — уходит POST kind:track с его id', async () => {
    const queue = [track('a'), track('b')];
    useJamRoomMock.mockReturnValue(baseRoom({ queue }));
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes('/join')) return { ok: true, json: async () => ({ participant: { id: 'p1', role: 'HOST' } }) };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );
    fireEvent.click(screen.getByText('Подключиться к звуку'));
    await waitFor(() => expect(screen.queryByText('Подключиться к звуку')).toBeNull());

    fireEvent.click(screen.getByLabelText('Играть b'));

    await waitFor(() => {
      const playbackCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/playback'));
      expect(playbackCall).toBeTruthy();
      expect(playbackCall![1]!.body).toBe(JSON.stringify({ kind: 'track', trackId: 't-b' }));
    });
  });

  it('гость тоже может кликнуть трек в очереди — транспорт теперь у всех участников', async () => {
    const queue = [track('a'), track('b')];
    useJamRoomMock.mockReturnValue(baseRoom({ queue }));
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes('/join')) return { ok: true, json: async () => ({ participant: { id: 'p1', role: 'GUEST' } }) };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );
    fireEvent.click(screen.getByText('Подключиться к звуку'));
    await waitFor(() => expect(screen.queryByText('Подключиться к звуку')).toBeNull());

    fireEvent.click(screen.getByLabelText('Играть b'));

    await waitFor(() => {
      const playbackCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/playback'));
      expect(playbackCall).toBeTruthy();
      expect(playbackCall![1]!.body).toBe(JSON.stringify({ kind: 'track', trackId: 't-b', sessionId: 'guest-1.sig' }));
    });
  });

  it('бар «сейчас играет» показывает активный трек и кнопку паузы у хоста', async () => {
    const queue = [track('a'), track('b')];
    useJamRoomMock.mockReturnValue(
      baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 } }),
    );

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );
    await joinAs('HOST');

    expect(screen.getByText('Играет')).toBeTruthy();
    expect(screen.getByLabelText('Поставить джем на паузу')).toBeTruthy();
  });

  it('бар «сейчас играет» у гостя тоже показывает кнопку управления — транспорт у всех участников', async () => {
    const queue = [track('a'), track('b')];
    useJamRoomMock.mockReturnValue(
      baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: true, pausedPositionMs: 5000, version: 1 } }),
    );
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes('/join')) return { ok: true, json: async () => ({ participant: { id: 'p1', role: 'GUEST' } }) };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );
    fireEvent.click(screen.getByText('Подключиться к звуку'));
    await waitFor(() => expect(screen.queryByText('Подключиться к звуку')).toBeNull());

    expect(screen.getByText('На паузе')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Возобновить джем'));

    await waitFor(() => {
      const playbackCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/playback'));
      expect(playbackCall).toBeTruthy();
      expect(playbackCall![1]!.body).toBe(JSON.stringify({ kind: 'play', trackId: 't-a', positionMs: 5000, sessionId: 'guest-1.sig' }));
    });
  });

  it('переход в ended после входа гасит звук синхронизации (audioEnabled=false для playback-sync) и чистит jam-override', async () => {
    const queue = [track('a')];
    useJamRoomMock.mockReturnValue(
      baseRoom({ queue, playback: { trackId: 't-a', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 } }),
    );

    const { rerender } = render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );
    await joinAs('HOST');
    expect(usePlaybackSyncMock).toHaveBeenLastCalledWith(expect.objectContaining({ audioEnabled: true }));
    await waitFor(() =>
      expect(usePlayerStoreForTest.getState().jamOverride).toEqual({
        code: 'A2B3C4',
        track: { title: 'a', artistName: 'Artist', coverUrl: null },
        isPlaying: true,
      }),
    );

    useJamRoomMock.mockReturnValue(baseRoom({ queue, ended: true }));
    rerender(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );

    expect(usePlaybackSyncMock).toHaveBeenLastCalledWith(expect.objectContaining({ audioEnabled: false }));
    await waitFor(() => expect(usePlayerStoreForTest.getState().jamOverride).toBeNull());
  });
});

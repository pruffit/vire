// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { JamParticipant, JamPlaybackState, JamQueueItem, SearchTrack } from '@vire/core';
import type { JamSessionValue } from '@/components/jam/jam-session-provider';

const { useJamSessionMock, activateMock, getSessionIdMock, controlsPauseMock } = vi.hoisted(() => ({
  useJamSessionMock: vi.fn(),
  activateMock: vi.fn(),
  getSessionIdMock: vi.fn(),
  controlsPauseMock: vi.fn(),
}));

vi.mock('@/components/jam/jam-session-provider', () => ({ useJamSession: useJamSessionMock }));
vi.mock('@/store/jam', () => ({
  useJamStore: (selector: (s: { activate: typeof activateMock }) => unknown) => selector({ activate: activateMock }),
}));
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
  useDragControls: () => ({ start: () => {} }),
}));

import { JamRoom } from './jam-room';

function baseRoom(overrides?: Partial<JamSessionValue['room']>): JamSessionValue['room'] {
  return {
    queue: [], version: 0, participants: [], playback: null, mode: 'SYNCED', speakerParticipantId: null,
    presentParticipantIds: [], connected: true, ended: false, setDragging: vi.fn(),
    ...overrides,
  };
}

function baseSession(overrides?: Omit<Partial<JamSessionValue>, 'room'> & { room?: Partial<JamSessionValue['room']> }): JamSessionValue {
  const { room: roomOverrides, ...rest } = overrides ?? {};
  return {
    code: 'A2B3C4',
    membership: { participantId: 'p1', role: 'GUEST', sessionId: 'guest-1.sig' },
    role: 'GUEST',
    isHost: false,
    room: baseRoom(roomOverrides),
    serverNow: () => 0,
    isAudioDevice: true,
    speakerName: null,
    playbackPending: null,
    isPlaying: false,
    activeTrackId: null,
    actions: {
      rowPlay: vi.fn(),
      toggle: vi.fn(),
      changeMode: vi.fn(),
      claimSpeaker: vi.fn(),
      endJam: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn(),
    },
    ...rest,
  };
}

function participant(overrides?: Partial<JamParticipant>): JamParticipant {
  return {
    id: 'p1',
    jamId: 'jam-1',
    userId: null,
    guestSessionId: 'guest-1',
    displayName: 'Гость',
    role: 'GUEST',
    joinedAt: new Date('2026-07-20T12:00:00Z'),
    lastSeenAt: new Date('2026-07-20T12:00:00Z'),
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

function searchTrack(id: string): SearchTrack {
  return {
    id,
    title: id,
    releaseId: 'release-1',
    artistSlug: 'artist',
    artistName: 'Artist',
    coverUrl: null,
    version: null,
    feat: [],
  };
}

const playback = (trackId: string, overrides?: Partial<JamPlaybackState>): JamPlaybackState => ({
  trackId, startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1, ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  getSessionIdMock.mockResolvedValue('guest-1.sig');
  useJamSessionMock.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('JamRoom: экран входа', () => {
  it('без активной сессии показывает название и хоста', () => {
    render(
      <JamRoom code="A2B3C4" title="Пятничный джем" hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );

    expect(screen.getByText('Пятничный джем')).toBeTruthy();
    expect(screen.getByText('Хост — Danya')).toBeTruthy();
  });

  it('клик «Подключиться к звуку» шлёт join, глушит плеер и активирует джем в сторе', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ participant: { id: 'p1', role: 'GUEST' } }) } as unknown as Response),
    );

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );
    fireEvent.click(screen.getByText('Подключиться к звуку'));

    await waitFor(() => expect(activateMock).toHaveBeenCalledWith({
      code: 'A2B3C4', participantId: 'p1', role: 'GUEST', sessionId: 'guest-1.sig',
    }));
    expect(controlsPauseMock).toHaveBeenCalledTimes(1);
  });

  it('уже завершённый джем (без сессии) показывает финальный экран без возможности войти', () => {
    render(
      <JamRoom code="A2B3C4" title="Party" hostDisplayName="Danya" initialEnded isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );

    expect(screen.getByText('Джем завершён')).toBeTruthy();
    expect(screen.queryByText('Подключиться к звуку')).toBeNull();
  });

  it('чужой код в контексте (session.code !== code страницы) считается отсутствием сессии — снова экран входа', () => {
    useJamSessionMock.mockReturnValue(baseSession({ code: 'ZZZZZZ' }));
    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );

    expect(screen.getByText('Подключиться к звуку')).toBeTruthy();
  });
});

describe('JamRoom: комната', () => {
  it('гость видит пустую очередь и не видит контролов хоста', () => {
    useJamSessionMock.mockReturnValue(baseSession({ isHost: false, role: 'GUEST' }));
    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );

    expect(screen.getByText('Очередь пуста')).toBeTruthy();
    expect(screen.queryByText('Завершить джем')).toBeNull();
  });

  it('хост видит кнопку завершения джема и она зовёт actions.endJam', async () => {
    const session = baseSession({ isHost: true, role: 'HOST' });
    useJamSessionMock.mockReturnValue(session);
    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );

    fireEvent.click(screen.getByText('Завершить джем'));
    await waitFor(() => expect(session.actions.endJam).toHaveBeenCalledTimes(1));
  });

  it('уже присоединённый джем, помеченный ended в контексте, показывает финальный экран', () => {
    useJamSessionMock.mockReturnValue(baseSession({ room: { ended: true } }));
    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );

    expect(screen.getByText('Джем завершён')).toBeTruthy();
  });

  it('клик по треку в очереди зовёт actions.rowPlay с этим треком', () => {
    const queue = [track('a'), track('b')];
    const session = baseSession({ room: { queue } });
    useJamSessionMock.mockReturnValue(session);

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );
    fireEvent.click(screen.getByLabelText('Играть b'));

    expect(session.actions.rowPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 'b', trackId: 't-b' }));
  });

  it('активный трек в очереди подсвечен по playback.trackId, isPlaying берётся из контекста', () => {
    const queue = [track('a'), track('b')];
    const session = baseSession({ isPlaying: true, room: { queue, playback: playback('t-b') } });
    useJamSessionMock.mockReturnValue(session);

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );

    expect(screen.getByLabelText('Пауза')).toBeTruthy();
  });

  it('повторное добавление уже добавленного трека не шлёт второй POST add', async () => {
    const session = baseSession({ isHost: true, role: 'HOST' });
    useJamSessionMock.mockReturnValue(session);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(
      <JamRoom
        code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya"
        suggestions={[searchTrack('sugg-1')]}
      />,
    );

    fireEvent.click(screen.getByText('Добавить трек'));
    const dialog = await screen.findByRole('dialog');
    const addButton = within(dialog).getByText('sugg-1').closest('button')!;
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    await waitFor(() => {
      const addCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/queue'));
      expect(addCalls).toHaveLength(1);
    });
  });

  it('панель добавления закрывается по onClose (Esc)', async () => {
    useJamSessionMock.mockReturnValue(baseSession({ isHost: true, role: 'HOST' }));
    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );

    fireEvent.click(screen.getByText('Добавить трек'));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('SPEAKER: пульт видит имя колонки и кнопку «Звук здесь», клик зовёт actions.claimSpeaker', () => {
    const host = participant({ id: 'p-host', role: 'HOST', displayName: 'Хост Данила' });
    const session = baseSession({
      isAudioDevice: false,
      room: { mode: 'SPEAKER', participants: [host, participant({ id: 'p1', role: 'GUEST' })] },
      speakerName: 'Хост Данила',
    });
    useJamSessionMock.mockReturnValue(session);

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );

    expect(screen.getByText('Играет на устройстве Хост Данила')).toBeTruthy();
    fireEvent.click(screen.getByText('Звук здесь'));
    expect(session.actions.claimSpeaker).toHaveBeenCalledTimes(1);
  });

  it('SPEAKER: колонка видит пометку «Звук здесь» без кнопки', () => {
    const session = baseSession({
      isAudioDevice: true,
      room: { mode: 'SPEAKER', participants: [participant({ id: 'p1', role: 'GUEST' })], speakerParticipantId: 'p1' },
    });
    useJamSessionMock.mockReturnValue(session);

    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={[]} />,
    );

    const badges = screen.getAllByText('Звук здесь');
    expect(badges).toHaveLength(1);
    expect(badges[0]!.closest('button')).toBeNull();
  });

  it('хост меняет режим через ActionSelect — зовёт actions.changeMode', () => {
    const session = baseSession({ isHost: true, role: 'HOST' });
    useJamSessionMock.mockReturnValue(session);
    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={[]} />,
    );

    fireEvent.click(screen.getByLabelText('Режим воспроизведения'));
    fireEvent.click(screen.getByText('На колонке'));

    expect(session.actions.changeMode).toHaveBeenCalledWith('SPEAKER');
  });
});

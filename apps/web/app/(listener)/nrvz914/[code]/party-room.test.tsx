// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JamParticipant, JamPlaybackState, JamQueueItem, SearchTrack } from '@vire/core';
import type { JamSessionValue } from '@/components/jam/jam-session-provider';

const { useJamSessionMock, activateMock, getSessionIdMock, controlsPauseMock, setPartyVideoContainerMock } = vi.hoisted(() => ({
  useJamSessionMock: vi.fn(),
  activateMock: vi.fn(),
  getSessionIdMock: vi.fn(),
  controlsPauseMock: vi.fn(),
  setPartyVideoContainerMock: vi.fn(),
}));

vi.mock('@/components/jam/jam-session-provider', () => ({ useJamSession: useJamSessionMock }));
vi.mock('@/store/jam', () => ({
  useJamStore: (selector: (s: { activate: typeof activateMock; audioEnabled: boolean; enableAudio: () => void }) => unknown) =>
    selector({ activate: activateMock, audioEnabled: true, enableAudio: vi.fn() }),
}));
vi.mock('@/lib/player/audio-engine', () => ({ controls: { pause: controlsPauseMock } }));
vi.mock('@/lib/session-id', () => ({ getSessionId: getSessionIdMock }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock('@/lib/jam/sources/video-container', () => ({ setPartyVideoContainer: setPartyVideoContainerMock }));

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

import { PartyRoom } from './party-room';

function baseRoom(overrides?: Partial<JamSessionValue['room']>): JamSessionValue['room'] {
  return {
    queue: [], version: 0, participants: [], playback: null, mode: 'SYNCED', speakerParticipantId: null,
    presentParticipantIds: [], connected: true, ended: false, skipVotes: null, setDragging: vi.fn(),
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
    activeItemId: null,
    activeTrackId: null,
    votedSkipItemId: null,
    actions: {
      rowPlay: vi.fn(),
      toggle: vi.fn(),
      changeMode: vi.fn(),
      claimSpeaker: vi.fn(),
      voteSkip: vi.fn(),
      endJam: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn(),
    },
    ...rest,
  };
}

function participant(overrides?: Partial<JamParticipant>): JamParticipant {
  return {
    id: 'p1', jamId: 'jam-1', userId: null, guestSessionId: 'guest-1', displayName: 'Гость', role: 'GUEST',
    joinedAt: new Date('2026-08-02T12:00:00Z'), lastSeenAt: new Date('2026-08-02T12:00:00Z'),
    ...overrides,
  };
}

function vireTrack(id: string): JamQueueItem {
  return {
    id, source: 'VIRE', trackId: `t-${id}`, externalId: null, externalUrl: null, position: 0,
    addedByParticipantId: null, addedAt: new Date('2026-08-02T12:00:00Z'),
    title: id, durationSec: null, artistName: 'Artist', artistSlug: 'artist', releaseId: 'release-1',
    coverUrl: null, accentColor: null, isExplicit: false, version: null, feat: [],
  };
}

function externalTrack(id: string): JamQueueItem {
  return {
    id, source: 'YOUTUBE', trackId: null, externalId: 'yt-1', externalUrl: 'https://youtu.be/yt-1', position: 0,
    addedByParticipantId: null, addedAt: new Date('2026-08-02T12:00:00Z'),
    title: 'External Song', durationSec: 200, artistName: 'External Artist',
    artistSlug: null, releaseId: null, coverUrl: null, accentColor: null, isExplicit: null, version: null, feat: null,
  };
}

const playback = (itemId: string, overrides?: Partial<JamPlaybackState>): JamPlaybackState => ({
  itemId, startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1, ...overrides,
});

const suggestions: SearchTrack[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  getSessionIdMock.mockResolvedValue('guest-1.sig');
  useJamSessionMock.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PartyRoom: экран входа', () => {
  it('без активной сессии показывает эйбрау «Вечеринка»', () => {
    render(
      <PartyRoom code="A2B3C4" title="Пятничная тусовка" hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={suggestions} />,
    );

    expect(screen.getByText('Вечеринка')).toBeTruthy();
    expect(screen.getByText('Пятничная тусовка')).toBeTruthy();
  });

  it('уже завершённая (без сессии) показывает «Вечеринка завершена»', () => {
    render(
      <PartyRoom code="A2B3C4" title="Party" hostDisplayName="Danya" initialEnded isLoggedIn={false} currentUserName={null} suggestions={suggestions} />,
    );

    expect(screen.getByText('Вечеринка завершена')).toBeTruthy();
  });
});

describe('PartyRoom: комната', () => {
  it('внешняя позиция очереди рендерится с бейджем источника и снапшотом метаданных', () => {
    const session = baseSession({ room: { queue: [externalTrack('e1')] } });
    useJamSessionMock.mockReturnValue(session);

    render(
      <PartyRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={suggestions} />,
    );

    expect(screen.getByText('External Song')).toBeTruthy();
    expect(screen.getByText('External Artist')).toBeTruthy();
    expect(screen.getByText('YouTube')).toBeTruthy();
  });

  it('каталожная позиция не показывает бейдж источника', () => {
    const session = baseSession({ room: { queue: [vireTrack('a')] } });
    useJamSessionMock.mockReturnValue(session);

    render(
      <PartyRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={suggestions} />,
    );

    expect(screen.queryByText('YouTube')).toBeNull();
  });

  it('«Экран вечеринки» клеймит спикера и открывает витрину', async () => {
    const session = baseSession({ isHost: true, role: 'HOST', room: { queue: [vireTrack('a')], playback: playback('a') } });
    useJamSessionMock.mockReturnValue(session);

    render(
      <PartyRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={suggestions} />,
    );

    fireEvent.click(screen.getByText('Экран вечеринки'));

    expect(session.actions.claimSpeaker).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByAltText('QR-код комнаты')).toBeTruthy());
    expect(setPartyVideoContainerMock).toHaveBeenCalled();
  });

  it('кнопка добавления локального файла видна только на устройстве-колонке', () => {
    const audioDevice = baseSession({ isAudioDevice: true });
    useJamSessionMock.mockReturnValue(audioDevice);
    const { unmount } = render(
      <PartyRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={suggestions} />,
    );
    expect(screen.getByText('Файл с устройства')).toBeTruthy();
    unmount();

    const remote = baseSession({ isAudioDevice: false, room: { mode: 'SPEAKER' } });
    useJamSessionMock.mockReturnValue(remote);
    render(
      <PartyRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={suggestions} />,
    );
    expect(screen.queryByText('Файл с устройства')).toBeNull();
  });

  it('хост завершает вечеринку', async () => {
    const session = baseSession({ isHost: true, role: 'HOST' });
    useJamSessionMock.mockReturnValue(session);
    render(
      <PartyRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={suggestions} />,
    );

    fireEvent.click(screen.getByText('Завершить'));
    await waitFor(() => expect(session.actions.endJam).toHaveBeenCalledTimes(1));
  });

  it('голосование за пропуск: гость видит счётчик и не может проголосовать дважды', () => {
    const session = baseSession({
      votedSkipItemId: 'a',
      room: { queue: [vireTrack('a')], playback: playback('a'), skipVotes: { itemId: 'a', votes: 1, needed: 2 } },
    });
    useJamSessionMock.mockReturnValue(session);

    render(
      <PartyRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={suggestions} />,
    );

    const button = screen.getByRole('button', { name: /Пропустить/ }) as HTMLButtonElement;
    expect(button.textContent).toContain('1/2');
    expect(button.disabled).toBe(true);
  });

  it('голосование за пропуск: у хоста нет счётчика и голос всегда проходит', () => {
    const session = baseSession({
      isHost: true, role: 'HOST',
      room: { queue: [vireTrack('a')], playback: playback('a'), skipVotes: { itemId: 'a', votes: 1, needed: 2 } },
    });
    useJamSessionMock.mockReturnValue(session);

    render(
      <PartyRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" suggestions={suggestions} />,
    );

    const button = screen.getByRole('button', { name: /Пропустить/ }) as HTMLButtonElement;
    expect(button.textContent).not.toContain('1/2');
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    expect(session.actions.voteSkip).toHaveBeenCalledWith('a');
  });

  it('SPEAKER: пульт видит имя колонки', () => {
    const host = participant({ id: 'p-host', role: 'HOST', displayName: 'Хост Данила' });
    const session = baseSession({
      isAudioDevice: false,
      room: { mode: 'SPEAKER', participants: [host] },
      speakerName: 'Хост Данила',
    });
    useJamSessionMock.mockReturnValue(session);

    render(
      <PartyRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} suggestions={suggestions} />,
    );

    expect(screen.getByText('Играет на устройстве Хост Данила')).toBeTruthy();
  });
});

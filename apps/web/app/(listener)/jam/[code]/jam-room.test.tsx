// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JamParticipant, JamQueueItem } from '@vire/core';

const { useJamRoomMock, getSessionIdMock } = vi.hoisted(() => ({
  useJamRoomMock: vi.fn(),
  getSessionIdMock: vi.fn(),
}));

vi.mock('@/lib/jam/use-jam-room', () => ({ useJamRoom: useJamRoomMock }));
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

import { JamRoom } from './jam-room';

interface RoomState {
  queue: JamQueueItem[];
  version: number;
  participants: JamParticipant[];
  playback: null;
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

beforeEach(() => {
  vi.clearAllMocks();
  getSessionIdMock.mockResolvedValue('guest-1.sig');
  useJamRoomMock.mockReturnValue(baseRoom());
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
      <JamRoom code="A2B3C4" title="Пятничный джем" hostDisplayName="Danya" initialEnded={false} isLoggedIn={false} currentUserName={null} />,
    );

    expect(screen.getByText('Пятничный джем')).toBeTruthy();
    expect(screen.getByText('Хост — Danya')).toBeTruthy();

    await joinAs('GUEST');

    expect(screen.getByText('Очередь пуста')).toBeTruthy();
    expect(screen.queryByText('Завершить джем')).toBeNull();
    expect(screen.getByText('Воспроизведением управляет хост')).toBeTruthy();
  });

  it('хост видит кнопку завершения джема и не видит гостевую подпись про хоста', async () => {
    render(
      <JamRoom code="A2B3C4" title={null} hostDisplayName="Danya" initialEnded={false} isLoggedIn currentUserName="Danya" />,
    );

    await joinAs('HOST');

    expect(screen.getByText('Завершить джем')).toBeTruthy();
    expect(screen.queryByText('Воспроизведением управляет хост')).toBeNull();
  });

  it('уже завершённый джем показывает финальный экран без возможности войти', () => {
    render(
      <JamRoom code="A2B3C4" title="Party" hostDisplayName="Danya" initialEnded isLoggedIn={false} currentUserName={null} />,
    );

    expect(screen.getByText('Джем завершён')).toBeTruthy();
    expect(screen.queryByText('Подключиться к звуку')).toBeNull();
  });
});

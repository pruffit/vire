// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/is-desktop-pointer', () => ({ useIsDesktopPointer: () => false }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock('@/store/player', () => ({ usePlayerStore: (sel: (s: unknown) => unknown) => sel({ track: null }) }));

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const C = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
          const dom = Object.fromEntries(
            Object.entries(props).filter(
              ([k]) => !['initial', 'animate', 'exit', 'transition', 'whileTap', 'whileHover', 'layoutId',
                'drag', 'dragListener', 'dragControls', 'dragConstraints', 'dragElastic', 'onDragEnd'].includes(k),
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
  useDragControls: () => ({ start: vi.fn() }),
}));

import { AddToPlaylistButton } from './add-to-playlist-button';

let playlistsResponse: { playlists: { id: string; title: string; trackCount: number }[]; inPlaylists: string[] };

beforeEach(() => {
  playlistsResponse = { playlists: [{ id: 'pl1', title: 'Вечер', trackCount: 3 }], inPlaylists: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (typeof url === 'string' && url.startsWith('/api/v1/playlists?trackId=')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(playlistsResponse) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AddToPlaylistButton (тач)', () => {
  it('открытие показывает контент внутри Sheet (role=dialog) с заголовком и плейлистом', async () => {
    render(<AddToPlaylistButton trackId="t1" />);
    fireEvent.click(screen.getByLabelText('Добавить в плейлист'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).not.toBeNull();
    expect(screen.getByText('Плейлисты')).not.toBeNull();
    expect(await screen.findByText('Вечер')).not.toBeNull();
  });

  const check = () => screen.getByText('Вечер').closest('button')!.querySelector('svg');

  it('клик по плейлисту шлёт POST и optimistic-отмечает чекбокс', async () => {
    render(<AddToPlaylistButton trackId="t1" />);
    fireEvent.click(screen.getByLabelText('Добавить в плейлист'));

    await screen.findByText('Вечер');
    expect(check()).toBeNull();

    fireEvent.click(screen.getByText('Вечер'));

    await waitFor(() => expect(check()).not.toBeNull());
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/playlists/pl1/tracks',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ trackId: 't1' }) }),
    );
  });

  it('клик по уже добавленному плейлисту шлёт DELETE и снимает отметку', async () => {
    playlistsResponse.inPlaylists = ['pl1'];
    render(<AddToPlaylistButton trackId="t1" />);
    fireEvent.click(screen.getByLabelText('Добавить в плейлист'));

    await screen.findByText('Вечер');
    await waitFor(() => expect(check()).not.toBeNull());

    fireEvent.click(screen.getByText('Вечер'));

    await waitFor(() => expect(check()).toBeNull());
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/playlists/pl1/tracks/t1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

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

import { PlaylistShare } from './playlist-share';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PlaylistShare', () => {
  it('приватный плейлист у не-владельца не рендерится', () => {
    const { container } = render(
      <PlaylistShare playlistId="p1" title="Тайное" visibility="PRIVATE" isOwner={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('публичный плейлист у не-владельца — только копирование, без публикации', () => {
    render(<PlaylistShare playlistId="p1" title="Открытое" visibility="PUBLIC" isOwner={false} />);
    fireEvent.click(screen.getByLabelText('Поделиться плейлистом'));
    expect(screen.getByText('Скопировать ссылку')).toBeTruthy();
    expect(screen.queryByText('Сделать публичным и поделиться')).toBeNull();
  });

  it('приватный у владельца — публикация + копирование ссылки', async () => {
    render(<PlaylistShare playlistId="p1" title="Моё" visibility="PRIVATE" isOwner />);
    fireEvent.click(screen.getByLabelText('Поделиться плейлистом'));
    fireEvent.click(screen.getByText('Сделать публичным и поделиться'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/playlists/p1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ visibility: 'PUBLIC' }) }),
      );
      expect(writeText).toHaveBeenCalledWith('http://localhost:3000/playlists/p1');
    });
  });

  it('ошибка публикации откатывает видимость', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    render(<PlaylistShare playlistId="p1" title="Моё" visibility="PRIVATE" isOwner />);
    fireEvent.click(screen.getByLabelText('Поделиться плейлистом'));
    fireEvent.click(screen.getByText('Сделать публичным и поделиться'));

    await waitFor(() => {
      expect(writeText).not.toHaveBeenCalled();
      expect(screen.getByText('Сделать публичным и поделиться')).toBeTruthy();
    });
  });

  it('пересинхронизируется, когда проп visibility меняется извне (PlaylistSettingsMenu)', () => {
    const { rerender } = render(
      <PlaylistShare playlistId="p1" title="Моё" visibility="PRIVATE" isOwner />,
    );
    fireEvent.click(screen.getByLabelText('Поделиться плейлистом'));
    expect(screen.getByText('Сделать публичным и поделиться')).toBeTruthy();

    rerender(<PlaylistShare playlistId="p1" title="Моё" visibility="PUBLIC" isOwner />);
    expect(screen.getByText('Скопировать ссылку')).toBeTruthy();

    rerender(<PlaylistShare playlistId="p1" title="Моё" visibility="PRIVATE" isOwner />);
    expect(screen.getByText('Сделать публичным и поделиться')).toBeTruthy();
  });

  it('дизейблит пункт публикации, пока запрос летит — не даёт скопировать ссылку раньше времени', async () => {
    let resolveFetch: (v: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })),
    );
    render(<PlaylistShare playlistId="p1" title="Моё" visibility="PRIVATE" isOwner />);
    fireEvent.click(screen.getByLabelText('Поделиться плейлистом'));
    fireEvent.click(screen.getByText('Сделать публичным и поделиться'));

    await waitFor(() => {
      const item = screen.getByText('Публикуем…').closest('button');
      expect(item?.disabled).toBe(true);
    });
    expect(writeText).not.toHaveBeenCalled();

    resolveFetch({ ok: true } as Response);
    await waitFor(() => expect(writeText).toHaveBeenCalled());
  });
});

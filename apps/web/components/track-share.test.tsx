// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/lib/is-desktop-pointer', () => ({ useIsDesktopPointer: () => true }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

// motion в jsdom не завершает exit-анимации — рендерим без них
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

import { toast } from '@/lib/toast';
import { TrackShare } from './track-share';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => cleanup());

describe('TrackShare', () => {
  it('открытое меню содержит «Ссылка на трек»', () => {
    render(<TrackShare />);
    fireEvent.click(screen.getByLabelText('Поделиться'));
    expect(screen.getByText('Ссылка на трек')).toBeTruthy();
  });

  it('«С текущего момента» отсутствует при currentTime<=2', () => {
    render(<TrackShare currentTime={2} />);
    fireEvent.click(screen.getByLabelText('Поделиться'));
    expect(screen.queryByText('С текущего момента')).toBeNull();
  });

  it('«С текущего момента» присутствует при currentTime>2 с хинтом', () => {
    render(<TrackShare currentTime={65} />);
    fireEvent.click(screen.getByLabelText('Поделиться'));
    expect(screen.getByText('С текущего момента')).toBeTruthy();
    expect(screen.getByText('1:05')).toBeTruthy();
  });

  it('клик по «Ссылка на трек» пишет base-url без query и вызывает toast', async () => {
    render(<TrackShare trackUrl="https://vire.example/t/1?foo=bar" />);
    fireEvent.click(screen.getByLabelText('Поделиться'));
    fireEvent.click(screen.getByText('Ссылка на трек'));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('https://vire.example/t/1?foo=bar'));
    expect(toast).toHaveBeenCalledWith('Ссылка скопирована');
  });

  it('клик по «С текущего момента» пишет url с ?t=<сек>', async () => {
    render(<TrackShare trackUrl="https://vire.example/t/1" currentTime={65.4} />);
    fireEvent.click(screen.getByLabelText('Поделиться'));
    fireEvent.click(screen.getByText('С текущего момента'));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('https://vire.example/t/1?t=65'));
    expect(toast).toHaveBeenCalledWith('Ссылка скопирована');
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Announcements } from './announcements';
import { OPEN_ANNOUNCEMENT_EVENT } from './widget-triggers';

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

describe('Announcements', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('авто-показывает первый непросмотренный анонс', () => {
    render(<Announcements />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Vire запущен')).toBeTruthy();
  });

  it('после закрытия второй анонс НЕ появляется в том же маунте, seen-флаг записан', () => {
    render(<Announcements />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('vire_notice_stage1_v1')).toBe('1');
    expect(screen.queryByText('Изменения во входе')).toBeNull();
  });

  it('в следующем маунте показывается следующий из очереди', () => {
    const first = render(<Announcements />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    first.unmount();

    render(<Announcements />);
    expect(screen.getByText('Изменения во входе')).toBeTruthy();
  });

  it('ручное открытие работает после потребления авто-показа и не пишет seen-флаг', () => {
    render(<Announcements />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));

    fireEvent(window, new CustomEvent(OPEN_ANNOUNCEMENT_EVENT, { detail: { id: 'auth' } }));
    expect(screen.getByText('Изменения во входе')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('vire_notice_auth_v1')).toBeNull();
  });
});

// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Popover } from './popover';

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

function TestPopover() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={({ open: expanded, toggle, ref }) => (
        <button ref={ref} type="button" onClick={toggle} aria-expanded={expanded}>
          Открыть
        </button>
      )}
    >
      <button type="button" onClick={() => setOpen(false)}>
        Пункт меню
      </button>
    </Popover>
  );
}

describe('Popover', () => {
  afterEach(() => cleanup());

  it('по умолчанию контент не отрендерен', () => {
    render(<TestPopover />);
    expect(screen.queryByText('Пункт меню')).toBeNull();
  });

  it('клик по триггеру раскрывает контент', () => {
    render(<TestPopover />);
    fireEvent.click(screen.getByText('Открыть'));
    expect(screen.getByText('Пункт меню')).toBeTruthy();
    expect(screen.getByText('Открыть').getAttribute('aria-expanded')).toBe('true');
  });

  it('Escape закрывает и возвращает фокус триггеру', () => {
    render(<TestPopover />);
    fireEvent.click(screen.getByText('Открыть'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Пункт меню')).toBeNull();
    expect(document.activeElement).toBe(screen.getByText('Открыть'));
  });

  it('клик вне закрывает поповер', () => {
    render(
      <div>
        <TestPopover />
        <button type="button">Снаружи</button>
      </div>,
    );
    fireEvent.click(screen.getByText('Открыть'));
    expect(screen.getByText('Пункт меню')).toBeTruthy();
    fireEvent.pointerDown(screen.getByText('Снаружи'));
    expect(screen.queryByText('Пункт меню')).toBeNull();
  });

  it('клик внутри поповера не закрывает его', () => {
    render(<TestPopover />);
    fireEvent.click(screen.getByText('Открыть'));
    fireEvent.pointerDown(screen.getByText('Пункт меню'));
    expect(screen.getByText('Пункт меню')).toBeTruthy();
  });

  it('клик по пункту меню закрывает поповер (onOpenChange из контента)', () => {
    render(<TestPopover />);
    fireEvent.click(screen.getByText('Открыть'));
    fireEvent.click(screen.getByText('Пункт меню'));
    expect(screen.queryByText('Пункт меню')).toBeNull();
  });
});

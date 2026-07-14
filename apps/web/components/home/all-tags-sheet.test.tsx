// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AllTagsSheet } from './all-tags-sheet';
import type { TagSheetSection } from './wave-chip-items';

const startWave = vi.fn(async (_seed: { mood?: string; genre?: string } | null) => true);

vi.mock('@/lib/player/audio-engine', () => ({
  controls: { startWave: (seed: { mood?: string; genre?: string } | null) => startWave(seed) },
}));

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
              ([k]) =>
                ![
                  'initial', 'animate', 'exit', 'transition', 'whileTap', 'whileHover', 'layoutId',
                  'drag', 'dragListener', 'dragControls', 'dragConstraints', 'dragElastic', 'onDragEnd',
                ].includes(k),
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

const sections: TagSheetSection[] = [
  { label: 'Настроения', items: [{ key: 'HYPE', label: 'Энергия', kind: 'mood', count: 12 }] },
  { label: 'Хип-хоп и R&B', items: [{ key: 'BOOMBAP', label: 'Boom Bap', kind: 'genre', count: 3 }] },
];

describe('AllTagsSheet', () => {
  beforeEach(() => startWave.mockClear());
  afterEach(() => cleanup());

  it('открытие показывает секции и теги со счётчиком', () => {
    render(<AllTagsSheet open onClose={vi.fn()} sections={sections} />);
    expect(screen.getByText('Настроения')).toBeTruthy();
    expect(screen.getByText('Хип-хоп и R&B')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Энергия/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Boom Bap/ })).toBeTruthy();
  });

  it('закрытый шит не рендерит контент', () => {
    render(<AllTagsSheet open={false} onClose={vi.fn()} sections={sections} />);
    expect(screen.queryByText('Настроения')).toBeNull();
  });

  it('фильтрует по вводу — оставляет только совпадающий тег и его секцию', () => {
    render(<AllTagsSheet open onClose={vi.fn()} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText('Найти тег…'), { target: { value: 'boom' } });
    expect(screen.queryByText('Настроения')).toBeNull();
    expect(screen.getByText('Хип-хоп и R&B')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Boom Bap/ })).toBeTruthy();
  });

  it('пустой результат поиска показывает сообщение', () => {
    render(<AllTagsSheet open onClose={vi.fn()} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText('Найти тег…'), { target: { value: 'zzz-no-match' } });
    expect(screen.getByText('Ничего не нашлось.')).toBeTruthy();
  });

  it('клик по тегу запускает волну с нужным seed и закрывает шит', async () => {
    const onClose = vi.fn();
    render(<AllTagsSheet open onClose={onClose} sections={sections} />);
    fireEvent.click(screen.getByRole('button', { name: /Boom Bap/ }));
    await waitFor(() => expect(startWave).toHaveBeenCalledWith({ genre: 'BOOMBAP' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('клик по mood-тегу запускает волну с seed { mood }', async () => {
    const onClose = vi.fn();
    render(<AllTagsSheet open onClose={onClose} sections={sections} />);
    fireEvent.click(screen.getByRole('button', { name: /Энергия/ }));
    await waitFor(() => expect(startWave).toHaveBeenCalledWith({ mood: 'HYPE' }));
  });
});

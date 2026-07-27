// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ArtistCard } from './artist-card';

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

const base = {
  id: 'a1',
  slug: 'artist-one',
  name: 'Artist One',
  avatarUrl: null as string | null,
  verified: false,
};

describe('ArtistCard', () => {
  afterEach(() => cleanup());

  it('показывает verified-бейдж, когда verified=true', () => {
    render(<ArtistCard {...base} verified />);
    expect(screen.getByRole('link').querySelector('svg')).toBeTruthy();
  });

  it('не показывает verified-бейдж, когда verified=false', () => {
    render(<ArtistCard {...base} verified={false} />);
    expect(screen.getByRole('link').querySelector('svg')).toBeNull();
  });

  it('рендерит stat, если передан', () => {
    render(<ArtistCard {...base} stat="12 релизов" />);
    expect(screen.getByText('12 релизов')).toBeTruthy();
  });

  it('не рендерит строку stat, если не передан', () => {
    render(<ArtistCard {...base} />);
    expect(screen.queryByText(/релиз/)).toBeNull();
  });

  it('падает на обложку релиза, если avatarUrl пуст', () => {
    render(<ArtistCard {...base} avatarUrl={null} coverFallbackUrl="https://cdn.example/cover.jpg" />);
    const img = screen.getByAltText('Artist One') as HTMLImageElement;
    expect(img.src).toContain('cover.jpg');
  });

  it('показывает инициал, если ни аватара, ни обложки нет', () => {
    render(<ArtistCard {...base} avatarUrl={null} coverFallbackUrl={null} />);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('показывает инициал по avatarUrl, когда он задан (обложка игнорируется)', () => {
    render(<ArtistCard {...base} avatarUrl="https://cdn.example/avatar.jpg" coverFallbackUrl="https://cdn.example/cover.jpg" />);
    const img = screen.getByAltText('Artist One') as HTMLImageElement;
    expect(img.src).toContain('avatar.jpg');
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { RankedDiscoveryArtist } from '@vire/core';

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

// ResizeObserver не реализован в jsdom — сама лента вне зоны ответственности этого теста
vi.mock('@/components/scroll-row', () => ({
  ScrollRow: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { buildDiscovery } = vi.hoisted(() => ({ buildDiscovery: vi.fn() }));
vi.mock('@/lib/discovery', () => ({ buildDiscovery }));

import { DiscoverySection, DISCOVERY_MIN_CANDIDATES } from './discovery-section';

function artist(overrides: Partial<RankedDiscoveryArtist> = {}): RankedDiscoveryArtist {
  return {
    artistProfileId: 'a1',
    artistSlug: 'a1',
    artistName: 'Artist One',
    artistAvatarUrl: null,
    verified: false,
    coListen: 0,
    tasteOverlap: 0,
    friendListeners: 0,
    sourceArtistId: 'a1',
    score: 1,
    reason: 'taste',
    ...overrides,
  };
}

describe('DiscoverySection', () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.clearAllMocks());

  it(`не рендерится ниже порога в ${DISCOVERY_MIN_CANDIDATES} кандидата`, async () => {
    buildDiscovery.mockResolvedValue(
      Array.from({ length: DISCOVERY_MIN_CANDIDATES - 1 }, (_, i) => artist({ artistProfileId: `a${i}` })),
    );
    const result = await DiscoverySection({ userId: 'u1' });
    expect(result).toBeNull();
  });

  it('рендерится на пороге и показывает подпись-причину по сигналу', async () => {
    buildDiscovery.mockResolvedValue([
      artist({ artistProfileId: 'a1', artistName: 'Friend Pick', reason: 'friends' }),
      artist({ artistProfileId: 'a2', artistName: 'Similar Pick', reason: 'similar' }),
      artist({ artistProfileId: 'a3', artistName: 'Taste Pick A', reason: 'taste' }),
      artist({ artistProfileId: 'a4', artistName: 'Taste Pick B', reason: 'taste' }),
    ]);
    const el = await DiscoverySection({ userId: 'u1' });
    expect(el).not.toBeNull();
    render(el!);

    expect(screen.getByText('Слушают ваши друзья')).toBeTruthy();
    expect(screen.getByText('Похоже на то, что вы слушаете')).toBeTruthy();
    expect(screen.getAllByText('В вашем жанре')).toHaveLength(2);
  });

  it('сбой buildDiscovery не роняет секцию — просто не рендерится', async () => {
    buildDiscovery.mockRejectedValue(new Error('db down'));
    const result = await DiscoverySection({ userId: 'u1' });
    expect(result).toBeNull();
  });
});

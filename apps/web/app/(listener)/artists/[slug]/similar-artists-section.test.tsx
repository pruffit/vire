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

const { buildSimilarArtists } = vi.hoisted(() => ({ buildSimilarArtists: vi.fn() }));
vi.mock('@/lib/discovery', () => ({ buildSimilarArtists }));

import { SimilarArtistsSection, SIMILAR_ARTISTS_MIN_CANDIDATES } from './similar-artists-section';

function artist(overrides: Partial<RankedDiscoveryArtist> = {}): RankedDiscoveryArtist {
  return {
    artistProfileId: 'a1',
    artistSlug: 'a1',
    artistName: 'Artist One',
    artistAvatarUrl: null,
    verified: false,
    coListen: 0.5,
    tasteOverlap: 0,
    friendListeners: 0,
    sourceArtistId: 'source-1',
    score: 1,
    reason: 'similar',
    ...overrides,
  };
}

describe('SimilarArtistsSection', () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.clearAllMocks());

  it(`не рендерится ниже порога в ${SIMILAR_ARTISTS_MIN_CANDIDATES} кандидата`, async () => {
    buildSimilarArtists.mockResolvedValue(
      Array.from({ length: SIMILAR_ARTISTS_MIN_CANDIDATES - 1 }, (_, i) => artist({ artistProfileId: `a${i}` })),
    );
    const result = await SimilarArtistsSection({ artistProfileId: 'source-1' });
    expect(result).toBeNull();
  });

  it('рендерится на пороге и показывает подпись-причину по сигналу (без друзей — аноним тоже видит блок)', async () => {
    buildSimilarArtists.mockResolvedValue([
      artist({ artistProfileId: 'a1', reason: 'similar' }),
      artist({ artistProfileId: 'a2', reason: 'taste' }),
      artist({ artistProfileId: 'a3', reason: 'taste' }),
    ]);
    const el = await SimilarArtistsSection({ artistProfileId: 'source-1' });
    expect(el).not.toBeNull();
    render(el!);

    expect(screen.getByText('Похожие артисты')).toBeTruthy();
    expect(screen.getByText('Похоже на то, что вы слушаете')).toBeTruthy();
    expect(screen.getAllByText('В вашем жанре')).toHaveLength(2);
  });

  it('сбой buildSimilarArtists не роняет страницу артиста — секция просто не рендерится', async () => {
    buildSimilarArtists.mockRejectedValue(new Error('db down'));
    const result = await SimilarArtistsSection({ artistProfileId: 'source-1' });
    expect(result).toBeNull();
  });
});

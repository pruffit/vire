import { describe, it, expect, vi } from 'vitest';
import { composeHomeScreen } from '@vire/core';
import { blockSchema } from '@vire/api-contracts';

// Компоненты секций тянут БД и next-intl — реестру для проверки покрытия достаточно ключей.
vi.mock('@/components/featured-release', () => ({ FeaturedRelease: () => null }));
vi.mock('@/components/home/flow-block', () => ({ FlowBlock: () => null }));
vi.mock('@/components/home/skeletons', () => ({ RailSkeleton: () => null, TrackListSkeleton: () => null }));
vi.mock('@/app/[locale]/(listener)/(home)/home-sections', () => ({
  PersonalBlock: () => null,
  FeedSection: () => null,
  FriendsActivitySection: () => null,
  HotTracksSection: () => null,
  FreshReleasesSection: () => null,
  UpcomingSection: () => null,
  ListeningNowSection: () => null,
  PlaylistsSection: () => null,
  ArtistsSection: () => null,
  DiscoverySection: () => null,
  CatalogEmptyNotice: () => null,
}));

const { HOME_BLOCK_RENDERERS } = await import('./home-registry');

describe('реестр рендереров главной', () => {
  it('покрывает каждый тип блока, который отдаёт композиция', () => {
    const types = composeHomeScreen({ isAuthenticated: true }).blocks.map((b) => b.type);
    for (const type of types) {
      expect(HOME_BLOCK_RENDERERS[type], `нет рендерера для '${type}'`).toBeDefined();
    }
  });

  it('каждая запись реестра умеет рендерить', () => {
    for (const [type, entry] of Object.entries(HOME_BLOCK_RENDERERS)) {
      expect(typeof entry.render, `рендерер '${type}'`).toBe('function');
    }
  });

  it('блоки композиции проходят контракт @vire/api-contracts', () => {
    for (const block of composeHomeScreen({ isAuthenticated: true }).blocks) {
      expect(blockSchema.safeParse(block).success, `блок '${block.type}' не прошёл схему`).toBe(true);
    }
  });

  it('скелетон есть ровно у блоков, которые его имели в статической ветке', () => {
    const withSkeleton = Object.entries(HOME_BLOCK_RENDERERS)
      .filter(([, entry]) => typeof entry.skeleton === 'function')
      .map(([type]) => type)
      .sort();
    expect(withSkeleton).toEqual(['artists', 'fresh-releases', 'hot-tracks', 'playlists']);
  });

  it('вне Suspense рендерятся только featured-release и flow — там LCP', () => {
    const eager = Object.entries(HOME_BLOCK_RENDERERS)
      .filter(([, entry]) => entry.eager)
      .map(([type]) => type)
      .sort();
    expect(eager).toEqual(['featured-release', 'flow']);
  });
});

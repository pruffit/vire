import { Fragment, Suspense, type ReactNode } from 'react';
import type { Block, BlockType } from '@vire/api-contracts';
import { FeaturedRelease } from '@/components/featured-release';
import { FlowBlock } from '@/components/home/flow-block';
import { RailSkeleton, TrackListSkeleton } from '@/components/home/skeletons';
import {
  PersonalBlock,
  FeedSection,
  FriendsActivitySection,
  HotTracksSection,
  FreshReleasesSection,
  UpcomingSection,
  ListeningNowSection,
  PlaylistsSection,
  ArtistsSection,
  DiscoverySection,
  CatalogEmptyNotice,
} from '@/app/[locale]/(listener)/(home)/home-sections';

export interface HomeRenderContext {
  userId?: string;
  featured: Parameters<typeof FeaturedRelease>[0]['release'] | null;
  featuredStats: Parameters<typeof FeaturedRelease>[0]['stats'];
  moods: Parameters<typeof FlowBlock>[0]['moods'];
  genres: Parameters<typeof FlowBlock>[0]['genres'];
  labels: {
    hotTracks: string;
    wholeCatalog: string;
    freshReleases: string;
    viewAll: string;
    playlists: string;
    artists: string;
    allArtists: string;
  };
}

interface RendererEntry {
  render(ctx: HomeRenderContext): ReactNode;
  /** null — блок появляется без скелетона (как в статической ветке). */
  skeleton?(ctx: HomeRenderContext): ReactNode;
  /** Блок вне Suspense: FeaturedRelease держит LCP-изображение. */
  eager?: boolean;
}

// Реестр обязан покрывать каждый тип протокола — это проверяется тестом.
export const HOME_BLOCK_RENDERERS: Record<BlockType, RendererEntry> = {
  'featured-release': {
    eager: true,
    render: (ctx) => (ctx.featured ? <FeaturedRelease release={ctx.featured} stats={ctx.featuredStats} /> : null),
  },
  flow: {
    eager: true,
    render: (ctx) => <FlowBlock moods={ctx.moods} genres={ctx.genres} />,
  },
  personal: {
    render: (ctx) => (ctx.userId ? <PersonalBlock userId={ctx.userId} /> : null),
  },
  feed: {
    render: (ctx) => (ctx.userId ? <FeedSection userId={ctx.userId} /> : null),
  },
  'friends-activity': {
    render: (ctx) => (ctx.userId ? <FriendsActivitySection userId={ctx.userId} /> : null),
  },
  'hot-tracks': {
    render: () => <HotTracksSection />,
    // rows = лимит getPopularTracks — иначе замена скелетона сдвигает всё ниже
    skeleton: (ctx) => (
      <TrackListSkeleton title={ctx.labels.hotTracks} rows={20} href="/releases" hrefLabel={ctx.labels.wholeCatalog} />
    ),
  },
  'fresh-releases': {
    render: () => <FreshReleasesSection />,
    skeleton: (ctx) => (
      <RailSkeleton
        title={ctx.labels.freshReleases}
        cardWidth="flex-[1_0_12rem] max-w-[14rem] min-w-0"
        href="/releases"
        hrefLabel={ctx.labels.viewAll}
      />
    ),
  },
  upcoming: { render: () => <UpcomingSection /> },
  'listening-now': { render: () => <ListeningNowSection /> },
  playlists: {
    render: (ctx) => <PlaylistsSection userId={ctx.userId} />,
    skeleton: (ctx) => <RailSkeleton title={ctx.labels.playlists} cardWidth="flex-[1_0_10rem] max-w-[14rem] min-w-0" />,
  },
  artists: {
    render: () => <ArtistsSection />,
    skeleton: (ctx) => (
      <RailSkeleton
        title={ctx.labels.artists}
        cardWidth="flex-[1_0_7rem] max-w-[11rem] min-w-0"
        href="/artists"
        hrefLabel={ctx.labels.allArtists}
        round
      />
    ),
  },
  discovery: {
    render: (ctx) => (ctx.userId ? <DiscoverySection userId={ctx.userId} /> : null),
  },
  'catalog-empty-notice': { render: () => <CatalogEmptyNotice /> },
};

export function renderHomeBlock(block: Block, ctx: HomeRenderContext): ReactNode {
  // Незнакомый тип молча пропускается — страховка на рассинхронизацию версий.
  const entry = HOME_BLOCK_RENDERERS[block.type];
  if (!entry) return null;
  // Fragment, а не div: PageContainer расставляет отступы по прямым детям.
  if (entry.eager) return <Fragment key={block.id}>{entry.render(ctx)}</Fragment>;
  return (
    <Suspense key={block.id} fallback={entry.skeleton ? entry.skeleton(ctx) : null}>
      {entry.render(ctx)}
    </Suspense>
  );
}

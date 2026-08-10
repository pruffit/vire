import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getMoodCounts, getGenreCounts, getReleaseCardStats } from '@vire/db';
import { FeaturedRelease } from '@/components/featured-release';
import { FlowBlock } from '@/components/home/flow-block';
import { JsonLd } from '@/components/json-ld';
import { PageContainer } from '@/components/page-container';
import { websiteJsonLd } from '@/lib/structured-data';
import { localizedAlternates } from '@/lib/metadata';
import { SITE_NAME, siteDescription } from '@/lib/site';
import { resolveLocale } from '@/lib/locale';
import { RailSkeleton, TrackListSkeleton } from '@/components/home/skeletons';
import {
  cachedLatestReleases,
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
} from './home-sections';
import type { Metadata } from 'next';

// OG-картинка наследуется из app/opengraph-image.tsx, title/description — из layout;
// только canonical/hreflang зависят от локали и проставляются здесь.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  return { alternates: localizedAlternates(locale, '/') };
}

export default async function HomePage() {
  const [t, locale] = await Promise.all([getTranslations('home'), resolveLocale()]);
  const session = await auth();
  const userId = session?.user?.id;

  const [latest, moodCounts, genreCounts] = await Promise.all([
    cachedLatestReleases(),
    getMoodCounts().catch(() => []),
    getGenreCounts().catch(() => []),
  ]);

  const featured = latest[0] ?? null;
  const featuredStats = featured ? await getReleaseCardStats(featured.id).catch(() => null) : null;

  return (
    <PageContainer spaceY="home">
      <JsonLd data={websiteJsonLd({ name: SITE_NAME, description: await siteDescription(locale), locale })} />
      <h1 className="sr-only">VireMusic — {t('srHeading')}</h1>

      {/* без FadeUp — FeaturedRelease содержит LCP-изображение, opacity-анимация задержала бы LCP */}
      {featured && <FeaturedRelease release={featured} stats={featuredStats} />}

      <FlowBlock moods={moodCounts} genres={genreCounts} />

      {userId && (
        <Suspense fallback={null}>
          <PersonalBlock userId={userId} />
        </Suspense>
      )}

      {userId && (
        <Suspense fallback={null}>
          <FeedSection userId={userId} />
        </Suspense>
      )}

      {userId && (
        <Suspense fallback={null}>
          <FriendsActivitySection userId={userId} />
        </Suspense>
      )}

      {/* rows = лимит getPopularTracks — иначе замена скелетона сдвигает всё ниже */}
      <Suspense fallback={<TrackListSkeleton title={t('sections.hotTracks')} rows={20} href="/releases" hrefLabel={t('sections.wholeCatalog')} />}>
        <HotTracksSection />
      </Suspense>

      <Suspense fallback={<RailSkeleton title={t('sections.freshReleases')} cardWidth="flex-[1_0_12rem] max-w-[14rem] min-w-0" href="/releases" hrefLabel={t('sections.viewAll')} />}>
        <FreshReleasesSection />
      </Suspense>

      <Suspense fallback={null}>
        <UpcomingSection />
      </Suspense>

      <Suspense fallback={null}>
        <ListeningNowSection />
      </Suspense>

      <Suspense fallback={<RailSkeleton title={t('sections.playlists')} cardWidth="flex-[1_0_10rem] max-w-[14rem] min-w-0" />}>
        <PlaylistsSection userId={userId} />
      </Suspense>

      <Suspense fallback={<RailSkeleton title={t('sections.artists')} cardWidth="flex-[1_0_7rem] max-w-[11rem] min-w-0" href="/artists" hrefLabel={t('sections.allArtists')} round />}>
        <ArtistsSection />
      </Suspense>

      {userId && (
        <Suspense fallback={null}>
          <DiscoverySection userId={userId} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <CatalogEmptyNotice />
      </Suspense>
    </PageContainer>
  );
}

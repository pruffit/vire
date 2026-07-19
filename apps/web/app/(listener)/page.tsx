import { Suspense } from 'react';
import { auth } from '@/auth';
import { getMoodCounts, getGenreCounts, getReleaseCardStats } from '@vire/db';
import { FeaturedRelease } from '@/components/featured-release';
import { FlowBlock } from '@/components/home/flow-block';
import { JsonLd } from '@/components/json-ld';
import { websiteJsonLd } from '@/lib/structured-data';
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
  CatalogEmptyNotice,
} from './home-sections';
import type { Metadata } from 'next';

// OG-картинка наследуется из app/opengraph-image.tsx, title/description — из layout
export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
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
    <main className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-16">
      <JsonLd data={websiteJsonLd()} />
      <h1 className="sr-only">Vire — независимая музыкальная площадка для артистов и слушателей СНГ</h1>

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
      <Suspense fallback={<TrackListSkeleton title="Горячие треки" rows={20} href="/releases" hrefLabel="Весь каталог" />}>
        <HotTracksSection />
      </Suspense>

      <Suspense fallback={<RailSkeleton title="Свежие релизы" cardWidth="flex-[1_0_12rem] max-w-[14rem] min-w-0" href="/releases" hrefLabel="Посмотреть все" />}>
        <FreshReleasesSection />
      </Suspense>

      <Suspense fallback={null}>
        <UpcomingSection />
      </Suspense>

      <Suspense fallback={null}>
        <ListeningNowSection />
      </Suspense>

      <Suspense fallback={<RailSkeleton title="Подборки" cardWidth="flex-[1_0_10rem] max-w-[14rem] min-w-0" />}>
        <PlaylistsSection userId={userId} />
      </Suspense>

      <Suspense fallback={<RailSkeleton title="Артисты" cardWidth="flex-[1_0_7rem] max-w-[11rem] min-w-0" href="/artists" hrefLabel="Все артисты" round />}>
        <ArtistsSection />
      </Suspense>

      <Suspense fallback={null}>
        <CatalogEmptyNotice />
      </Suspense>
    </main>
  );
}

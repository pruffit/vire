import { auth } from '@/auth';
import {
  getLatestReleases,
  listReleases,
  getUpcomingReleases,
  listActiveArtists,
  getFeed,
  getMoodCounts,
  getGenreCounts,
  getEditorialPlaylists,
  getPersonalPlaylists,
  getPopularPlaylists,
  getPublicUserPlaylists,
  getLikedPlaylistIds,
  getPopularTracks,
  getRecentlyPlayed,
  getPersonalTrackPicks,
  getReleaseCardStats,
} from '@vire/db';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { ScrollRow } from '@/components/scroll-row';
import { ArtistHoverChip } from '@/components/artist-hover-chip';
import { FeaturedRelease } from '@/components/featured-release';
import { ListeningNow } from '@/components/listening-now';
import { EditorialPlaylistCard } from '@/components/editorial-playlist-card';
import { HotTracks } from '@/components/home/hot-tracks';
import { FlowBlock } from '@/components/home/flow-block';
import { RecentRail } from '@/components/home/recent-rail';
import { PlayableTrackList } from '@/components/track-list';
import { getListeningNow } from '@/lib/listening-now';
import { JsonLd } from '@/components/json-ld';
import { Section } from '@/components/listener/section';
import { websiteJsonLd } from '@/lib/structured-data';
import type { Metadata } from 'next';

// OG-картинка наследуется из app/opengraph-image.tsx, title/description — из layout
export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [
    latest, freshWeek, upcoming, artists, feed, listeningNow, moodCounts, genreCounts,
    sharedPlaylists, personalRaw, publicPlaylists, likedPlaylistIds,
    hotTracks, recent, personalPicks,
  ] = await Promise.all([
    getLatestReleases(19).catch(() => []),
    // .catch — главная не должна падать целиком из-за одной секции.
    listReleases({ sort: 'fresh', sinceDays: 7, limit: 18 }).catch(() => []),
    getUpcomingReleases(8).catch(() => []),
    listActiveArtists().catch(() => []),
    userId ? getFeed(userId).catch(() => []) : Promise.resolve([]),
    getListeningNow(6).catch(() => []),
    getMoodCounts().catch(() => []),
    getGenreCounts().catch(() => []),
    getEditorialPlaylists(4).catch(() => []),
    userId ? getPersonalPlaylists(userId, 4).catch(() => []) : Promise.resolve([]),
    getPublicUserPlaylists(12).catch(() => []),
    userId ? getLikedPlaylistIds(userId).catch(() => []) : Promise.resolve([] as string[]),
    getPopularTracks(30, 20).catch(() => []),
    userId ? getRecentlyPlayed(userId, 12).catch(() => []) : Promise.resolve([]),
    userId ? getPersonalTrackPicks(userId, 12).catch(() => []) : Promise.resolve([]),
  ]);

  // Подборки: 4 общих + 4 личных (добор популярным при нехватке), плюс плейлисты слушателей — в одной секции.
  let personalPlaylists = personalRaw;
  if (personalPlaylists.length < 4) {
    const exclude = [...sharedPlaylists, ...personalPlaylists].map((p) => p.id);
    const fill = await getPopularPlaylists(4 - personalPlaylists.length, exclude).catch(() => []);
    personalPlaylists = [...personalPlaylists, ...fill];
  }
  const seen = new Set<string>();
  const allPlaylists = [...sharedPlaylists, ...personalPlaylists, ...publicPlaylists]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

  const recentIds = new Set(recent.map((t) => t.id));
  const personalPicksDeduped = personalPicks.filter((t) => !recentIds.has(t.id));

  const featured = latest[0] ?? null;
  const featuredStats = featured ? await getReleaseCardStats(featured.id).catch(() => null) : null;
  // на маленьком каталоге неделя бывает пустой — добиваем общим списком свежего
  const weekFresh = freshWeek.filter((r) => r.id !== featured?.id);
  const rest = (weekFresh.length >= 4 ? weekFresh : latest.slice(1)).slice(0, 18);
  const topArtists = artists.slice(0, 12);
  const empty = latest.length === 0 && upcoming.length === 0 && topArtists.length === 0;

  return (
    <main className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-16">
      <JsonLd data={websiteJsonLd()} />
      <h1 className="sr-only">Vire — независимая музыкальная площадка для артистов и слушателей СНГ</h1>

      {/* без FadeUp — FeaturedRelease содержит LCP-изображение, opacity-анимация задержала бы LCP */}
      {featured && <FeaturedRelease release={featured} stats={featuredStats} />}

      <FlowBlock moods={moodCounts} genres={genreCounts} />

      {!!userId && <RecentRail tracks={recent} />}

      {!!userId && personalPicksDeduped.length >= 4 && (
        <Section title="Для тебя">
          <PlayableTrackList variant="plain" columns={2} tracks={personalPicksDeduped} context={{ source: 'home' }} />
        </Section>
      )}

      {!!userId && feed.length > 0 && (
        <Section title="Новое у подписок">
          <ScrollRow bleedClassName="-mx-1" className="flex gap-5 px-1 snap-x">
            {feed.slice(0, 12).map((r) => (
              <div key={r.id} className="shrink-0 w-40 snap-start">
                <ReleaseQuickLook release={r} />
              </div>
            ))}
          </ScrollRow>
        </Section>
      )}

      <HotTracks tracks={hotTracks} />

      {rest.length > 0 && (
        <Section title="Свежие релизы" count={rest.length} href="/releases" hrefLabel="Посмотреть все">
          {/* -my/py: overflow-x-auto клипает и по Y — иначе hover-тень карточек срезается */}
          <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
            {rest.map((r) => (
              <div key={r.id} className="shrink-0 w-48 snap-start">
                <ReleaseQuickLook release={r} />
              </div>
            ))}
          </ScrollRow>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Скоро выйдет" count={upcoming.length}>
          <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
            {upcoming.map((r) => (
              <div key={r.id} className="shrink-0 w-40 snap-start">
                <ReleaseQuickLook release={r} upcoming />
              </div>
            ))}
          </ScrollRow>
        </Section>
      )}

      <ListeningNow initial={listeningNow} />

      {allPlaylists.length > 0 && (
        <Section title="Подборки" count={allPlaylists.length}>
          <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
            {allPlaylists.map((p) => (
              <div key={p.id} className="shrink-0 w-40 snap-start">
                <EditorialPlaylistCard playlist={p} liked={likedPlaylistIds.includes(p.id)} />
              </div>
            ))}
          </ScrollRow>
        </Section>
      )}

      {topArtists.length > 0 && (
        <Section title="Артисты" count={topArtists.length} href="/artists" hrefLabel="Все артисты">
          <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
            {topArtists.map((a) => (
              <div key={a.id} className="shrink-0 w-28 snap-start">
                <ArtistHoverChip artist={a} />
              </div>
            ))}
          </ScrollRow>
        </Section>
      )}

      {empty && (
        <p className="text-center text-sm text-muted-foreground py-12">
          Пока пусто. Скоро здесь появится музыка.
        </p>
      )}
    </main>
  );
}

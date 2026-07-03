import { auth } from '@/auth';
import {
  getLatestReleases,
  listReleases,
  getUpcomingReleases,
  listActiveArtists,
  getFeed,
  getMoodCounts,
  getEditorialPlaylists,
  getPersonalPlaylists,
  getPopularPlaylists,
  getPublicUserPlaylists,
  getLikedPlaylistIds,
  getPopularTracks,
  getRecentlyPlayed,
  getPersonalTrackPicks,
} from '@vire/db';
import { ReleaseQuickLook } from '@/components/release-quick-look';
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

// Главная: явный canonical (в аудите был пустой). OG-картинку наследует из
// app/opengraph-image.tsx, title/description — из layout.
export const metadata: Metadata = { alternates: { canonical: '/' } };

const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6';

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [
    latest, freshWeek, upcoming, artists, feed, listeningNow, moodCounts,
    sharedPlaylists, personalRaw, publicPlaylists, likedPlaylistIds,
    hotTracks, recent, personalPicks,
  ] = await Promise.all([
    getLatestReleases(13).catch(() => []),
    // .catch — главная не должна падать целиком из-за одной секции.
    listReleases({ sort: 'fresh', sinceDays: 7, limit: 12 }).catch(() => []),
    getUpcomingReleases(8).catch(() => []),
    listActiveArtists().catch(() => []),
    userId ? getFeed(userId).catch(() => []) : Promise.resolve([]),
    getListeningNow(6).catch(() => []),
    getMoodCounts().catch(() => []),
    getEditorialPlaylists(4).catch(() => []),
    userId ? getPersonalPlaylists(userId, 4).catch(() => []) : Promise.resolve([]),
    getPublicUserPlaylists(8).catch(() => []),
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

  const featured = latest[0] ?? null;
  // «Свежие релизы» = вышедшие за последние 7 дней (без редакционного featured).
  // На маленьком каталоге неделя бывает пустой/скудной — тогда добиваем общим
  // списком свежего, чтобы секция не выглядела поломанной.
  const weekFresh = freshWeek.filter((r) => r.id !== featured?.id);
  const rest = (weekFresh.length >= 4 ? weekFresh : latest.slice(1)).slice(0, 8);
  const topArtists = artists.slice(0, 12);
  const empty = latest.length === 0 && upcoming.length === 0 && topArtists.length === 0;

  return (
    <main className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-16">
      <JsonLd data={websiteJsonLd()} />
      <h1 className="sr-only">Vire — независимая музыкальная площадка для артистов и слушателей СНГ</h1>

      {/* Редакционный выбор — без FadeUp: FeaturedRelease содержит LCP-изображение,
          анимация opacity:0→1 задерживает его обнаружение браузером (+1-2с на LCP) */}
      {featured && <FeaturedRelease release={featured} />}

      {/* «Включи и слушай» — сразу под баннером, всем */}
      <FlowBlock moods={moodCounts} />

      {/* Персональный верх (вошедшим, самоскрывается) */}
      {!!userId && <RecentRail tracks={recent} />}

      {!!userId && personalPicks.length > 0 && (
        <Section title="Для тебя">
          <PlayableTrackList variant="plain" columns={2} tracks={personalPicks} context={{ source: 'home' }} />
        </Section>
      )}

      {!!userId && feed.length > 0 && (
        <Section title="Новое у подписок">
          <div className="flex gap-5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {feed.slice(0, 12).map((r) => (
              <div key={r.id} className="shrink-0 w-40 snap-start">
                <ReleaseQuickLook release={r} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Открытия (всем) */}
      <HotTracks tracks={hotTracks} />

      {/* Каталог (всем) */}
      {rest.length > 0 && (
        <Section title="Свежие релизы" href="/releases" hrefLabel="Посмотреть все">
          <div className={GRID}>
            {rest.map((r) => <ReleaseQuickLook key={r.id} release={r} />)}
          </div>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Скоро выйдет">
          <div className={GRID}>
            {upcoming.map((r) => <ReleaseQuickLook key={r.id} release={r} upcoming />)}
          </div>
        </Section>
      )}

      <ListeningNow initial={listeningNow} />

      {allPlaylists.length > 0 && (
        <Section title="Подборки">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
            {allPlaylists.map((p) => (
              <EditorialPlaylistCard key={p.id} playlist={p} liked={likedPlaylistIds.includes(p.id)} />
            ))}
          </div>
        </Section>
      )}

      {topArtists.length > 0 && (
        <Section title="Артисты" href="/artists" hrefLabel="Все артисты">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-5">
            {topArtists.map((a) => <ArtistHoverChip key={a.id} artist={a} />)}
          </div>
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

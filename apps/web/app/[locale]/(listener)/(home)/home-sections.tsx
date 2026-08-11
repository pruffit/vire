import { cache } from 'react';
import { getTranslations } from 'next-intl/server';
import { getLatestReleases, getUpcomingReleases, listActiveArtists, DrizzleHomeBlocksRepository } from '@vire/db';
import { HomeBlocksService, type IHomeBlocksRepository, type HomePlaylistsBlock, type HomePersonalBlock } from '@vire/core';
import { FriendsActivityFeed } from '@/components/friends/friends-activity-feed';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { ScrollRow } from '@/components/scroll-row';
import { ArtistCard } from '@/components/artist-card';
import { ListeningNow } from '@/components/listening-now';
import { EditorialPlaylistCard } from '@/components/editorial-playlist-card';
import { HotTracks } from '@/components/home/hot-tracks';
import { RecentRail } from '@/components/home/recent-rail';
import { PlayableTrackList } from '@/components/track-list';
import { getListeningNow } from '@/lib/listening-now';
import { Section } from '@/components/listener/section';

export { FeedSection } from '@/components/home/feed-section';
export { DiscoverySection } from '@/components/home/discovery-section';

export const cachedLatestReleases = cache(() => getLatestReleases(19).catch(() => []));
const cachedUpcoming = cache(() => getUpcomingReleases(8).catch(() => []));
const cachedArtists = cache(() => listActiveArtists().catch(() => []));

// latestReleases/upcomingReleases идут через те же cache()-обёртки, что и CatalogEmptyNotice
// — иначе блок и уведомление о пустом каталоге читают одни и те же таблицы дважды за рендер.
const homeBlocksDb = new DrizzleHomeBlocksRepository();
const homeBlocksRepo: IHomeBlocksRepository = {
  latestReleases: () => cachedLatestReleases(),
  upcomingReleases: () => cachedUpcoming(),
  freshReleases: (params) => homeBlocksDb.freshReleases(params),
  popularTracks: (sinceDays, limit) => homeBlocksDb.popularTracks(sinceDays, limit),
  editorialPlaylists: (limit) => homeBlocksDb.editorialPlaylists(limit),
  personalPlaylists: (userId, limit) => homeBlocksDb.personalPlaylists(userId, limit),
  popularPlaylists: (limit, excludeIds) => homeBlocksDb.popularPlaylists(limit, excludeIds),
  publicUserPlaylists: (limit) => homeBlocksDb.publicUserPlaylists(limit),
  likedPlaylistIds: (userId) => homeBlocksDb.likedPlaylistIds(userId),
  recentlyPlayed: (userId, limit) => homeBlocksDb.recentlyPlayed(userId, limit),
  personalTrackPicks: (userId, limit) => homeBlocksDb.personalTrackPicks(userId, limit),
  friendsActivity: (userId, limit) => homeBlocksDb.friendsActivity(userId, limit),
};
const homeBlocks = new HomeBlocksService(homeBlocksRepo);

export async function PersonalBlock({ userId }: { userId: string }) {
  const t = await getTranslations('home.sections');
  const { recentlyPlayed, personalPicks } = await homeBlocks
    .personalBlock({ userId })
    .catch((): HomePersonalBlock => ({ recentlyPlayed: [], personalPicks: [] }));

  return (
    <>
      <RecentRail tracks={recentlyPlayed} />
      {personalPicks.length > 0 && (
        <Section title={t('forYou')}>
          <PlayableTrackList variant="plain" columns={2} tracks={personalPicks} context={{ source: 'home' }} />
        </Section>
      )}
    </>
  );
}

export async function FriendsActivitySection({ userId }: { userId: string }) {
  const t = await getTranslations('home.sections');
  const items = await homeBlocks.friendsActivityBlock({ userId }).catch(() => []);
  if (items.length === 0) return null;
  return (
    <Section title={t('friendsActivity')}>
      <FriendsActivityFeed items={items} />
    </Section>
  );
}

export async function HotTracksSection() {
  const hotTracks = await homeBlocks.hotTracksBlock().catch(() => []);
  return <HotTracks tracks={hotTracks} />;
}

export async function FreshReleasesSection() {
  const t = await getTranslations('home.sections');
  const rest = await homeBlocks.freshReleasesBlock().catch(() => []);
  if (rest.length === 0) return null;

  return (
    <Section title={t('freshReleases')} count={rest.length} href="/releases" hrefLabel={t('viewAll')}>
      {/* -my/py: overflow-x-auto клипает и по Y — иначе hover-тень карточек срезается */}
      <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
        {rest.map((r) => (
          <div key={r.id} className="flex-[1_0_12rem] max-w-[14rem] min-w-0 snap-start">
            <ReleaseQuickLook release={r} />
          </div>
        ))}
      </ScrollRow>
    </Section>
  );
}

export async function UpcomingSection() {
  const t = await getTranslations('home.sections');
  const upcoming = await homeBlocks.upcomingBlock().catch(() => []);
  if (upcoming.length === 0) return null;
  return (
    <Section title={t('comingSoon')} count={upcoming.length}>
      <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
        {upcoming.map((r) => (
          <div key={r.id} className="flex-[1_0_10rem] max-w-[14rem] min-w-0 snap-start">
            <ReleaseQuickLook release={r} upcoming />
          </div>
        ))}
      </ScrollRow>
    </Section>
  );
}

export async function ListeningNowSection() {
  const listeningNow = await getListeningNow(6).catch(() => []);
  return <ListeningNow initial={listeningNow} />;
}

export async function PlaylistsSection({ userId }: { userId?: string }) {
  const t = await getTranslations('home.sections');
  const { playlists: allPlaylists, likedPlaylistIds } = await homeBlocks
    .playlistsBlock({ viewerId: userId })
    .catch((): HomePlaylistsBlock => ({ playlists: [], likedPlaylistIds: [] }));

  if (allPlaylists.length === 0) return null;
  return (
    <Section title={t('playlists')} count={allPlaylists.length}>
      <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
        {allPlaylists.map((p) => (
          <div key={p.id} className="flex-[1_0_10rem] max-w-[14rem] min-w-0 snap-start">
            <EditorialPlaylistCard playlist={p} liked={likedPlaylistIds.includes(p.id)} />
          </div>
        ))}
      </ScrollRow>
    </Section>
  );
}

export async function ArtistsSection() {
  const t = await getTranslations('home.sections');
  const tCommon = await getTranslations('common');
  const artists = await cachedArtists();
  const topArtists = artists.slice(0, 12);
  if (topArtists.length === 0) return null;
  return (
    <Section title={t('artists')} count={topArtists.length} href="/artists" hrefLabel={t('allArtists')}>
      <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
        {topArtists.map((a) => (
          <div key={a.id} className="flex-[1_0_7rem] max-w-[11rem] min-w-0 snap-start">
            <ArtistCard
              variant="chip"
              id={a.id}
              slug={a.slug}
              name={a.name}
              avatarUrl={a.avatarUrl}
              coverFallbackUrl={a.firstReleaseCoverUrl}
              verified={a.verified}
              stat={a.releaseCount > 0 ? tCommon('releaseCount', { count: a.releaseCount }) : undefined}
            />
          </div>
        ))}
      </ScrollRow>
    </Section>
  );
}

export async function CatalogEmptyNotice() {
  const t = await getTranslations('home.sections');
  const [latest, upcoming, artists] = await Promise.all([cachedLatestReleases(), cachedUpcoming(), cachedArtists()]);
  if (latest.length > 0 || upcoming.length > 0 || artists.length > 0) return null;
  return (
    <p className="text-center text-sm text-muted-foreground py-12">
      {t('emptyCatalog')}
    </p>
  );
}

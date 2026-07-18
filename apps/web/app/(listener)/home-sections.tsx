import { cache } from 'react';
import {
  getLatestReleases,
  listReleases,
  getUpcomingReleases,
  listActiveArtists,
  getFeed,
  getEditorialPlaylists,
  getPersonalPlaylists,
  getPopularPlaylists,
  getPublicUserPlaylists,
  getLikedPlaylistIds,
  getPopularTracks,
  getRecentlyPlayed,
  getPersonalTrackPicks,
  getFriendsActivity,
} from '@vire/db';
import { mergeFriendsActivity } from '@/lib/activity';
import { FriendsActivityFeed } from '@/components/friends/friends-activity-feed';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { ScrollRow } from '@/components/scroll-row';
import { ArtistHoverChip } from '@/components/artist-hover-chip';
import { ListeningNow } from '@/components/listening-now';
import { EditorialPlaylistCard } from '@/components/editorial-playlist-card';
import { HotTracks } from '@/components/home/hot-tracks';
import { RecentRail } from '@/components/home/recent-rail';
import { PlayableTrackList } from '@/components/track-list';
import { getListeningNow } from '@/lib/listening-now';
import { Section } from '@/components/listener/section';

export const cachedLatestReleases = cache(() => getLatestReleases(19).catch(() => []));
const cachedUpcoming = cache(() => getUpcomingReleases(8).catch(() => []));
const cachedArtists = cache(() => listActiveArtists().catch(() => []));

export async function PersonalBlock({ userId }: { userId: string }) {
  const [recent, personalPicks] = await Promise.all([
    getRecentlyPlayed(userId, 12).catch(() => []),
    getPersonalTrackPicks(userId, 12).catch(() => []),
  ]);
  const recentIds = new Set(recent.map((t) => t.id));
  const personalPicksDeduped = personalPicks.filter((t) => !recentIds.has(t.id));

  return (
    <>
      <RecentRail tracks={recent} />
      {personalPicksDeduped.length >= 4 && (
        <Section title="Для тебя">
          <PlayableTrackList variant="plain" columns={2} tracks={personalPicksDeduped} context={{ source: 'home' }} />
        </Section>
      )}
    </>
  );
}

export async function FeedSection({ userId }: { userId: string }) {
  const feed = await getFeed(userId).catch(() => []);
  if (feed.length === 0) return null;
  return (
    <Section title="Новое у подписок">
      <ScrollRow bleedClassName="-mx-1" className="flex gap-5 px-1 snap-x">
        {feed.slice(0, 12).map((r) => (
          <div key={r.id} className="flex-[1_0_10rem] max-w-[14rem] min-w-0 snap-start">
            <ReleaseQuickLook release={r} />
          </div>
        ))}
      </ScrollRow>
    </Section>
  );
}

export async function FriendsActivitySection({ userId }: { userId: string }) {
  const raw = await getFriendsActivity(userId, 12).catch(() => null);
  if (!raw) return null;
  const items = mergeFriendsActivity(raw.likes, raw.follows, raw.playlists);
  if (items.length === 0) return null;
  return (
    <Section title="Активность друзей">
      <FriendsActivityFeed items={items} />
    </Section>
  );
}

export async function HotTracksSection() {
  const hotTracks = await getPopularTracks(30, 20).catch(() => []);
  return <HotTracks tracks={hotTracks} />;
}

export async function FreshReleasesSection() {
  const [freshWeek, latest] = await Promise.all([
    listReleases({ sort: 'fresh', sinceDays: 7, limit: 18 }).catch(() => []),
    cachedLatestReleases(),
  ]);
  const featured = latest[0] ?? null;
  // на маленьком каталоге неделя бывает пустой — добиваем общим списком свежего
  const weekFresh = freshWeek.filter((r) => r.id !== featured?.id);
  const rest = (weekFresh.length >= 4 ? weekFresh : latest.slice(1)).slice(0, 18);
  if (rest.length === 0) return null;

  return (
    <Section title="Свежие релизы" count={rest.length} href="/releases" hrefLabel="Посмотреть все">
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
  const upcoming = await cachedUpcoming();
  if (upcoming.length === 0) return null;
  return (
    <Section title="Скоро выйдет" count={upcoming.length}>
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
  const [sharedPlaylists, personalRaw, publicPlaylists, likedPlaylistIds] = await Promise.all([
    getEditorialPlaylists(4).catch(() => []),
    userId ? getPersonalPlaylists(userId, 4).catch(() => []) : Promise.resolve([]),
    getPublicUserPlaylists(12).catch(() => []),
    userId ? getLikedPlaylistIds(userId).catch(() => []) : Promise.resolve([] as string[]),
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

  if (allPlaylists.length === 0) return null;
  return (
    <Section title="Подборки" count={allPlaylists.length}>
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
  const artists = await cachedArtists();
  const topArtists = artists.slice(0, 12);
  if (topArtists.length === 0) return null;
  return (
    <Section title="Артисты" count={topArtists.length} href="/artists" hrefLabel="Все артисты">
      <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
        {topArtists.map((a) => (
          <div key={a.id} className="flex-[1_0_7rem] max-w-[11rem] min-w-0 snap-start">
            <ArtistHoverChip artist={a} />
          </div>
        ))}
      </ScrollRow>
    </Section>
  );
}

export async function CatalogEmptyNotice() {
  const [latest, upcoming, artists] = await Promise.all([cachedLatestReleases(), cachedUpcoming(), cachedArtists()]);
  if (latest.length > 0 || upcoming.length > 0 || artists.length > 0) return null;
  return (
    <p className="text-center text-sm text-muted-foreground py-12">
      Пока пусто. Скоро здесь появится музыка.
    </p>
  );
}

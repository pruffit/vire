import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import Link from 'next/link';
import { auth } from '@/auth';
import { getLikedTracksCached, getFollowedArtistsCached, getUserPlaylistsCached, getLikedPlaylistsCached, countUnseenIncomingCached } from '@/lib/listener-data';
import type { PlayerTrack } from '@/store/player';
import { likedToPlayerTrack } from '@/lib/player/liked-to-player-track';
import { LikedTrackRow } from '@/components/listener/liked-track-row';
import { FollowedArtists } from '@/components/listener/followed-artists';
import { PlaylistCard } from '@/components/listener/playlist-card';
import { Section } from '@/components/listener/section';
import { CreatePlaylistButton } from '@/components/listener/create-playlist-button';
import { EmptyState } from '@/components/ui-kit';
import { EditorialPlaylistCard } from '@/components/editorial-playlist-card';
import { Icon } from '@/components/icon';

export const metadata: Metadata = { title: 'Медиатека' };
export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/library');

  const [likedTracks, followedArtists, playlists, likedPlaylists, incomingCount] = await Promise.all([
    getLikedTracksCached(session.user.id),
    getFollowedArtistsCached(session.user.id),
    getUserPlaylistsCached(session.user.id),
    getLikedPlaylistsCached(session.user.id),
    countUnseenIncomingCached(session.user.id),
  ]);

  const likedQueue: PlayerTrack[] = likedTracks.map(likedToPlayerTrack);

  return (
    <main className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-14">
      <FadeUp>
        <h1 className="text-2xl font-semibold tracking-tight">Медиатека</h1>
      </FadeUp>

      {/* сайдбар с Джемом/Друзьями скрыт на мобилке (md:flex) — без таба в MobileTabBar единственный путь */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        <Link
          href="/jam"
          className="flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.03] px-4 py-3.5 transition-colors hover:bg-foreground/5"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-linear-to-br from-foreground/20 to-foreground/[0.06]">
            <Icon name="sliders" size={18} className="text-foreground" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Джем</span>
            <span className="block text-xs text-foreground/40">Слушать вместе</span>
          </span>
        </Link>
        <Link
          href="/friends"
          className="flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.03] px-4 py-3.5 transition-colors hover:bg-foreground/5"
        >
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md bg-linear-to-br from-foreground/20 to-foreground/[0.06]">
            <Icon name="users" size={18} className="text-foreground" />
            {incomingCount > 0 && (
              <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Друзья</span>
            <span className="block text-xs text-foreground/40">
              {incomingCount > 0 ? `${incomingCount} новых заявок` : 'Найти друзей'}
            </span>
          </span>
        </Link>
      </div>

      <Section title="Плейлисты" count={playlists.length} action={<CreatePlaylistButton variant="full" />}>
        {playlists.length === 0 ? (
          <EmptyState title="Нет плейлистов" hint='Нажми «Создать плейлист», чтобы собрать первый' />
        ) : (
          <Stagger step={0.04} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {playlists.map((p) => (
              <StaggerItem key={p.id}>
                <PlaylistCard playlist={p} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Section>

      {likedPlaylists.length > 0 && (
        <Section title="Лайкнутые подборки" count={likedPlaylists.length}>
          <Stagger step={0.04} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {likedPlaylists.map((p) => (
              <StaggerItem key={p.id}>
                <EditorialPlaylistCard playlist={p} liked />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      <div id="liked" className="scroll-mt-6">
        <Section title="Любимые треки" count={likedTracks.length}>
          {likedTracks.length === 0 ? (
            <EmptyState title="Ты ещё ничего не лайкал." />
          ) : (
            <Stagger step={0.035} className="flex flex-col">
              {likedTracks.map((track, i) => (
                <StaggerItem key={track.id}>
                  <LikedTrackRow
                    track={likedQueue[i]}
                    queue={likedQueue}
                    queueIndex={i}
                    durationSec={track.durationSec}
                    releaseCoverUrl={track.releaseCoverUrl}
                    artistSlug={track.artistSlug}
                    releaseId={track.releaseId}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </Section>
      </div>

      <Section title="Подписки" count={followedArtists.length}>
        <FollowedArtists initial={followedArtists} />
      </Section>
    </main>
  );
}

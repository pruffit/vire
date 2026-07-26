import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import Link from 'next/link';
import { auth } from '@/auth';
import { getLikedTracksCached, getFollowedArtistsCached, getUserPlaylistsCached, getLikedPlaylistsCached } from '@/lib/listener-data';
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

  const [likedTracks, followedArtists, playlists, likedPlaylists] = await Promise.all([
    getLikedTracksCached(session.user.id),
    getFollowedArtistsCached(session.user.id),
    getUserPlaylistsCached(session.user.id),
    getLikedPlaylistsCached(session.user.id),
  ]);

  const likedQueue: PlayerTrack[] = likedTracks.map(likedToPlayerTrack);

  return (
    <main className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-14">
      <FadeUp>
        <h1 className="text-2xl font-semibold tracking-tight">Медиатека</h1>
      </FadeUp>

      {/* Джем скрыт из сайдбара на мобилке (md:flex) — плитка единственный путь */}
      <div className="md:hidden">
        <Link
          href="/jam"
          className="flex items-center gap-3 rounded-xl border border-primary/20 bg-linear-to-br from-primary/10 to-primary/[0.03] px-4 py-3.5 transition-colors hover:border-primary/30 hover:from-primary/15"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-linear-to-br from-primary/30 to-primary/10">
            <Icon name="sliders" size={22} className="text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">Джем</span>
            <span className="block text-xs text-foreground/50">Слушать вместе</span>
          </span>
          <Icon name="chevron-right" size={18} className="shrink-0 text-primary/50" />
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

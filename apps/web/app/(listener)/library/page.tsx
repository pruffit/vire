import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { getLikedTracksCached, getFollowedArtistsCached, getUserPlaylistsCached } from '@/lib/listener-data';
import type { PlayerTrack } from '@/store/player';
import { likedToPlayerTrack } from '@/lib/player/liked-to-player-track';
import { LikedTrackRow } from '@/components/listener/liked-track-row';
import { FollowedArtists } from '@/components/listener/followed-artists';
import { PlaylistCard } from '@/components/listener/playlist-card';
import { Section } from '@/components/listener/section';
import { CreatePlaylistButton } from '@/components/listener/create-playlist-button';
import { EmptyState } from '@/components/ui-kit';

export const metadata: Metadata = { title: 'Медиатека' };
export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/library');

  const [likedTracks, followedArtists, playlists] = await Promise.all([
    getLikedTracksCached(session.user.id),
    getFollowedArtistsCached(session.user.id),
    getUserPlaylistsCached(session.user.id),
  ]);

  const likedQueue: PlayerTrack[] = likedTracks.map(likedToPlayerTrack);

  return (
    <main className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-14">
      <FadeUp>
        <h1 className="text-2xl font-semibold tracking-tight">Медиатека</h1>
      </FadeUp>

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

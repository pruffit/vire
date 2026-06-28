import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { getLikedTracks, getFollowedArtists, getUserPlaylists } from '@vire/db';
import type { PlayerTrack } from '@/store/player';
import { LikedTrackRow } from '@/components/listener/liked-track-row';
import { FollowedArtists } from '@/components/listener/followed-artists';
import { PlaylistCard } from '@/components/listener/playlist-card';
import { Section } from '@/components/listener/section';
import { EmptyState } from '@/components/ui-kit';

export const metadata: Metadata = { title: 'Медиатека' };
export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/library');

  const [likedTracks, followedArtists, playlists] = await Promise.all([
    getLikedTracks(session.user.id),
    getFollowedArtists(session.user.id),
    getUserPlaylists(session.user.id),
  ]);

  const likedQueue: PlayerTrack[] = likedTracks.map((t) => ({
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    coverUrl: t.releaseCoverUrl,
    artistSlug: t.artistSlug,
    releaseId: t.releaseId,
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-14">
      <FadeUp>
        <h1 className="text-2xl font-semibold tracking-tight">Медиатека</h1>
      </FadeUp>

      <Section title="Плейлисты" count={playlists.length}>
        {playlists.length === 0 ? (
          <EmptyState title="Нет плейлистов" hint='Нажми «+» на странице трека, чтобы создать первый' />
        ) : (
          <Stagger step={0.04} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                    track={{
                      id: track.id,
                      title: track.title,
                      artistName: track.artistName,
                      coverUrl: track.releaseCoverUrl,
                      artistSlug: track.artistSlug,
                      releaseId: track.releaseId,
                    }}
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

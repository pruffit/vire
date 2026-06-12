import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { getLikedTracks, getFollowedArtists, getUserPlaylists, getUserProfile } from '@vire/db';
import type { PlayerTrack } from '@/store/player';
import { LikedTrackRow } from './liked-track-row';
import { FollowedArtists } from './followed-artists';
import { PlaylistCard } from './playlist-card';
import { ProfileCard } from './profile-card';
import { LinkedAccounts } from './linked-accounts';

export const metadata: Metadata = {
  title: 'Профиль',
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ link_error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/profile');

  const params = await searchParams;
  const linkError = params.link_error;

  const [likedTracks, followedArtists, playlists, profile] = await Promise.all([
    getLikedTracks(session.user.id),
    getFollowedArtists(session.user.id),
    getUserPlaylists(session.user.id),
    getUserProfile(session.user.id),
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
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-14">
      {/* Profile card */}
      <FadeUp>
        <ProfileCard
          user={{
            id: session.user.id,
            name: profile?.name ?? session.user.name ?? null,
            email: session.user.email ?? null,
            image: profile?.image ?? session.user.image ?? null,
            createdAt: profile?.createdAt ?? null,
          }}
          stats={{
            likes: likedTracks.length,
            following: followedArtists.length,
            playlists: playlists.length,
          }}
        />
      </FadeUp>

      {/* Linked accounts */}
      <FadeUp delay={0.05}>
        <LinkedAccounts userId={session.user.id} linkError={linkError} />
      </FadeUp>

      {/* Playlists */}
      <section className="space-y-4">
        <SectionHeader title="Плейлисты" count={playlists.length} />

        {playlists.length === 0 ? (
          <EmptyState
            text="Нет плейлистов"
            hint='Нажми «+» на странице трека, чтобы создать первый'
          />
        ) : (
          <Stagger step={0.04} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {playlists.map((p) => (
              <StaggerItem key={p.id}>
                <PlaylistCard playlist={p} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      {/* Liked tracks */}
      <section className="space-y-4">
        <SectionHeader title="Понравилось" count={likedTracks.length} />

        {likedTracks.length === 0 ? (
          <EmptyState text="Ты ещё ничего не лайкал." />
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
      </section>

      {/* Followed artists */}
      <section className="space-y-4">
        <SectionHeader title="Подписки" count={followedArtists.length} />
        <FollowedArtists initial={followedArtists} />
      </section>
    </main>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      {count > 0 && (
        <span className="text-xs font-mono text-muted-foreground tabular-nums">{count}</span>
      )}
    </div>
  );
}

function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="py-6 text-center space-y-1.5">
      <p className="text-sm text-muted-foreground">{text}</p>
      {hint && <p className="text-xs text-muted-foreground/60">{hint}</p>}
    </div>
  );
}

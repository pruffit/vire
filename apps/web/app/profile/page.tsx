import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { getLikedTracks, getFollowedArtists } from '@vire/db';
import type { PlayerTrack } from '@/store/player';
import { LikedTrackRow } from './liked-track-row';
import { FollowedArtists } from './followed-artists';

export const metadata: Metadata = {
  title: 'Профиль',
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/profile');

  const [likedTracks, followedArtists] = await Promise.all([
    getLikedTracks(session.user.id),
    getFollowedArtists(session.user.id),
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
      {/* Header */}
      <FadeUp>
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {session.user.name ?? session.user.email}
          </h1>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
        </header>
      </FadeUp>

      {/* Liked tracks */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Понравилось</h2>
          {likedTracks.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {likedTracks.length}
            </span>
          )}
        </div>

        {likedTracks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Ты ещё ничего не лайкал.
          </p>
        ) : (
          <Stagger step={0.035} className="flex flex-col">
            {likedTracks.map((track, i) => (
              <StaggerItem key={track.id}>
                <LikedTrackRow
                  track={{ id: track.id, title: track.title, artistName: track.artistName, coverUrl: track.releaseCoverUrl, artistSlug: track.artistSlug, releaseId: track.releaseId }}
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
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Подписки</h2>
          {followedArtists.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {followedArtists.length}
            </span>
          )}
        </div>

        <FollowedArtists initial={followedArtists} />
      </section>
    </main>
  );
}

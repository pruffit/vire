import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { getLikedTracks, getFollowedArtists } from '@vire/db';
import type { FollowedArtist } from '@vire/db';
import type { PlayerTrack } from '@/store/player';
import { LikedTrackRow } from './liked-track-row';
import { UnfollowButton } from './unfollow-button';

export const metadata: Metadata = {
  title: 'Профиль — Vire',
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
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-14">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {session.user.name ?? session.user.email}
        </h1>
        <p className="text-sm text-muted-foreground">{session.user.email}</p>
      </header>

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
          <div className="flex flex-col">
            {likedTracks.map((track, i) => (
              <LikedTrackRow
                key={track.id}
                track={{ id: track.id, title: track.title, artistName: track.artistName, coverUrl: track.releaseCoverUrl }}
                queue={likedQueue}
                queueIndex={i}
                durationSec={track.durationSec}
                releaseCoverUrl={track.releaseCoverUrl}
                artistSlug={track.artistSlug}
                releaseId={track.releaseId}
              />
            ))}
          </div>
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

        {followedArtists.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Ты ни на кого не подписан.{' '}
            <Link href="/artists" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Найти артистов →
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {followedArtists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ArtistCard({ artist }: { artist: FollowedArtist }) {
  return (
    <div className="group flex items-center gap-3 p-3 rounded-md bg-card hover:bg-accent/5 transition-colors border border-border/40">
      {artist.avatarUrl ? (
        <img
          src={artist.avatarUrl}
          alt={artist.name}
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-medium text-muted-foreground">
          {artist.name[0]?.toUpperCase()}
        </div>
      )}
      <Link href={`/artists/${artist.slug}`} className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
          {artist.name}
        </p>
        {artist.verified && (
          <p className="text-xs text-muted-foreground">верифицирован</p>
        )}
      </Link>
      <UnfollowButton artistSlug={artist.slug} />
    </div>
  );
}

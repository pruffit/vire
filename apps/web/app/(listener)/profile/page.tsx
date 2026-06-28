import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { FadeUp } from '@vire/ui/motion';
import { auth } from '@/auth';
import { getUserProfile } from '@vire/db';
import { getLikedTracksCached, getFollowedArtistsCached, getUserPlaylistsCached } from '@/lib/listener-data';
import { ProfileCard } from './profile-card';
import { LinkedAccounts } from './linked-accounts';
import { Icon } from '@/components/icon';

export const metadata: Metadata = { title: 'Профиль' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ link_error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/profile');

  const { link_error: linkError } = await searchParams;
  const [likedTracks, followedArtists, playlists, profile] = await Promise.all([
    getLikedTracksCached(session.user.id),
    getFollowedArtistsCached(session.user.id),
    getUserPlaylistsCached(session.user.id),
    getUserProfile(session.user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12 space-y-14">
      <FadeUp>
        <ProfileCard
          user={{
            id: session.user.id,
            name: profile?.name ?? session.user.name ?? null,
            email: session.user.email ?? null,
            image: profile?.image ?? session.user.image ?? null,
            createdAt: profile?.createdAt ?? null,
          }}
          stats={{ likes: likedTracks.length, following: followedArtists.length, playlists: playlists.length }}
        />
      </FadeUp>

      <FadeUp delay={0.05}>
        <Link
          href="/library"
          className="group flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
        >
          <span className="text-sm font-medium">Моя медиатека</span>
          <Icon name="arrow-right" size={16} className="text-foreground/40 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </FadeUp>

      <FadeUp delay={0.1}>
        <LinkedAccounts userId={session.user.id} linkError={linkError} />
      </FadeUp>
    </main>
  );
}

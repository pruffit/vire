import { redirect } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  getLikedTracksCached,
  getFollowedArtistsCached,
  getUserPlaylistsCached,
  getUserProfileCached,
  getUserPublicProfileCached,
  getListenerTasteCached,
  getUserLastfmUsernameCached,
} from '@/lib/listener-data';
import { mergeActivity } from '@/lib/activity';
import { auth } from '@/auth';
import { ProfileBanner } from '@/components/listener/profile/profile-banner';
import { ProfileHero } from '@/components/listener/profile/profile-hero';
import { TasteSection } from '@/components/listener/profile/taste-section';
import { ActivityFeed } from '@/components/listener/profile/activity-feed';
import { LibraryPreviews } from '@/components/listener/profile/library-previews';
import { AccountSection } from '@/components/listener/profile/account-section';
import { Section } from '@/components/listener/section';
import { FollowedArtists } from '@/components/listener/followed-artists';
import { PageContainer } from '@/components/page-container';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('profile');
  return { title: t('metaTitle') };
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ link_error?: string }> }) {
  const [session, locale, t] = await Promise.all([auth(), getLocale(), getTranslations('profile')]);
  if (!session?.user?.id) return redirect({ href: '/sign-in?callbackUrl=/profile', locale });

  const { link_error: linkError } = await searchParams;
  const [likedTracks, followedArtists, playlists, profile, taste, publicProfile, lastfmUsername] = await Promise.all([
    getLikedTracksCached(session.user.id),
    getFollowedArtistsCached(session.user.id),
    getUserPlaylistsCached(session.user.id),
    getUserProfileCached(session.user.id),
    getListenerTasteCached(session.user.id),
    getUserPublicProfileCached(session.user.id),
    getUserLastfmUsernameCached(session.user.id),
  ]);

  const stats = { likes: likedTracks.length, following: followedArtists.length, playlists: playlists.length };
  const likedMinutes = Math.round(likedTracks.reduce((s, t) => s + (t.durationSec ?? 0), 0) / 60);
  const activity = mergeActivity(likedTracks, followedArtists, playlists);

  return (
    <main className="min-h-full overflow-x-clip">
      <ProfileBanner />
      <PageContainer as="div" variant="overlap" spaceY="14">
        <ProfileHero
          user={{
            id: session.user.id,
            name: profile?.name ?? session.user.name ?? null,
            email: session.user.email ?? null,
            image: profile?.image ?? session.user.image ?? null,
            createdAt: profile?.createdAt ?? null,
          }}
          stats={stats}
          likedMinutes={likedMinutes}
        />

        <TasteSection genres={taste.topGenres} artists={taste.topArtists} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-8 lg:gap-12 items-start">
          <div className="flex flex-col gap-10">
            <ActivityFeed items={activity} />
            <section className="animate-fade-up">
              <Section title={t('followedArtistsSection.title')} href="/library" hrefLabel={t('followedArtistsSection.allLabel')}>
                <FollowedArtists initial={followedArtists.slice(0, 6)} />
              </Section>
            </section>
          </div>
          <LibraryPreviews playlists={playlists} likedTracks={likedTracks} />
        </div>

        <AccountSection
          userId={session.user.id}
          linkError={linkError}
          socialVisibility={publicProfile?.socialVisibility ?? 'FRIENDS'}
          discoverable={publicProfile?.discoverable ?? true}
          notifyEmail={publicProfile?.notifyEmail ?? true}
          lastfmUsername={lastfmUsername}
        />
      </PageContainer>
    </main>
  );
}

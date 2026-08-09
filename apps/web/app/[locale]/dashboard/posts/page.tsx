import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { listArtistPosts } from '@vire/db';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { PostsManager, type ClientPost } from './posts-manager';
import { DashboardPageHeader } from '@/components/ui-kit';

export const dynamic = 'force-dynamic';

export default async function DashboardPostsPage() {
  const [session, locale, t, tCommon] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations('dashboard.posts'),
    getTranslations('dashboard.common'),
  ]);
  if (!session?.user?.id) return redirect({ href: '/sign-in?callbackUrl=/dashboard/posts', locale });

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) {
    return (
      <p className="text-foreground/50">
        {t('noArtist')}
      </p>
    );
  }

  const posts = await listArtistPosts(artist.id);
  const initial: ClientPost[] = posts.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-8">
      <DashboardPageHeader
        backHref="/dashboard"
        backLabel={tCommon('dashboardLabel')}
        title={t('heading')}
        subtitle={t('subtitle')}
      />

      <PostsManager initialPosts={initial} artistSlug={artist.slug} />
    </div>
  );
}

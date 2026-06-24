import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listArtistPosts } from '@vire/db';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { PostsManager, type ClientPost } from './posts-manager';
import { DashboardPageHeader } from '@/components/ui-kit';

export const dynamic = 'force-dynamic';

export default async function DashboardPostsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/posts');

  const artist = await getActiveArtistForPage(session.user.id);
  if (!artist) {
    return (
      <p className="text-foreground/50">
        У тебя нет профиля артиста. Обратись к администратору для создания.
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
        title="Анонсы"
        subtitle="Новости и анонсы для подписчиков — появляются на странице артиста"
      />

      <PostsManager initialPosts={initial} artistSlug={artist.slug} />
    </div>
  );
}

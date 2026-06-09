import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, listArtistPosts } from '@vire/db';
import { PostsManager, type ClientPost } from './posts-manager';

export const dynamic = 'force-dynamic';

export default async function DashboardPostsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/posts');

  const artist = await new DrizzleArtistRepository(db).findByUserId(session.user.id);
  if (!artist) {
    return (
      <div className="min-h-full bg-background text-foreground">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <p className="text-white/50">
            У тебя нет профиля артиста. Обратись к администратору для создания.
          </p>
        </div>
      </div>
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
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Анонсы</h1>
            <p className="text-white/50 mt-1 text-sm">
              Новости и анонсы для подписчиков — появляются на странице артиста
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm px-3 py-1.5 rounded-md text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 transition-colors shrink-0"
          >
            ← Dashboard
          </Link>
        </div>

        <PostsManager initialPosts={initial} artistSlug={artist.slug} />
      </div>
    </div>
  );
}

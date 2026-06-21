import { listPostsAdmin } from '@vire/db';
import { PostAdminRow } from './post-admin-row';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage() {
  const posts = await listPostsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Посты</h1>
        <span className="text-sm text-white/40 tabular-nums">{posts.length}</span>
      </div>

      <div className="flex flex-col gap-3">
        {posts.map((p) => (
          <PostAdminRow key={p.id} post={p} />
        ))}
        {posts.length === 0 && <p className="text-center text-sm text-white/30 py-8">Постов нет</p>}
      </div>
    </div>
  );
}

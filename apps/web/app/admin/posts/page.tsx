import { listPostsAdmin } from '@vire/db';
import { PostAdminRow } from './post-admin-row';
import { getAdminAccess } from '@/lib/admin-access';
import { PageHeader, Panel, EmptyState } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage() {
  const [posts, { canModerate }] = await Promise.all([listPostsAdmin(), getAdminAccess()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Посты" count={posts.length} />

      {posts.length === 0 ? (
        <Panel>
          <EmptyState
            title="Постов пока нет"
            hint="Анонсы и новости артисты публикуют из своего дашборда."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((p) => (
            <PostAdminRow key={p.id} post={p} canMutate={canModerate} />
          ))}
        </div>
      )}
    </div>
  );
}

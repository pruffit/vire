import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { getLikedTracksCached, getFollowedArtistsCached, getUserPlaylistsCached } from '@/lib/listener-data';
import { Footer } from '@/components/footer';
import { ListenerSidebar } from '@/components/listener/listener-sidebar';

export default async function ListenerLayout({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const userId = session?.user?.id;
  const collapsed = cookieStore.get('vire_sidebar')?.value === 'rail';

  const [playlists, artists, liked] = userId
    ? await Promise.all([
        getUserPlaylistsCached(userId),
        getFollowedArtistsCached(userId),
        getLikedTracksCached(userId),
      ])
    : [[], [], []];

  // Двухпанельная оболочка (эталон — admin/layout.tsx): на десктопе сайдбар закреплён,
  // скролл живёт ТОЛЬКО во внутренней панели (а не в общем #main-content), иначе
  // sticky-сайдбар в общей скролл-области даёт смазывание контента при быстрой
  // прокрутке. На мобиле сайдбар скрыт, панель без overflow — скроллит внешняя область
  // как раньше. У панели нет горизонтального паддинга: full-bleed герои тянутся на
  // её ширину, отступы дают сами страницы.
  return (
    <div className="flex min-h-full flex-col md:h-full md:flex-row">
      <ListenerSidebar
        playlists={playlists.map((p) => ({ id: p.id, name: p.title, coverUrl: p.coverUrl ?? null }))}
        artists={artists.map((a) => ({ id: a.id, name: a.name, slug: a.slug, avatarUrl: a.avatarUrl ?? null }))}
        likedCount={liked.length}
        isGuest={!userId}
        initialCollapsed={collapsed}
      />

      {/* Скролл-пейн — обычный div: главный лендмарк страницы рендерят сами страницы. */}
      <div data-scroll-area className="flex min-w-0 flex-1 flex-col md:min-h-0 md:overflow-y-auto">
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </div>
  );
}

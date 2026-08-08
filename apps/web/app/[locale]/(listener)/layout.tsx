import { cookies } from 'next/headers';
import { auth } from '@/auth';
import {
  getLikedTracksCached,
  getFollowedArtistsCached,
  getUserPlaylistsCached,
  getUserProfileCached,
  countUnseenIncomingCached,
  countUnreadMessagesCached,
} from '@/lib/listener-data';
import { Footer } from '@/components/footer';
import { ListenerSidebar } from '@/components/listener/listener-sidebar';

export default async function ListenerLayout({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const userId = session?.user?.id;
  const collapsed = cookieStore.get('vire_sidebar')?.value === 'rail';

  const [playlists, artists, liked, userProfile, incomingCount, messagesUnread] = userId
    ? await Promise.all([
        getUserPlaylistsCached(userId),
        getFollowedArtistsCached(userId),
        getLikedTracksCached(userId),
        getUserProfileCached(userId),
        countUnseenIncomingCached(userId),
        countUnreadMessagesCached(userId),
      ])
    : [[], [], [], null, 0, 0];

  // desktop: сайдбар закреплён, скролл только во внутренней панели — иначе sticky-сайдбар
  // в общем #main-content смазывает контент при быстрой прокрутке
  return (
    <div className="flex min-h-full flex-col [&:has([data-app-screen])]:h-full md:h-full md:flex-row">
      <ListenerSidebar
        playlists={playlists.map((p) => ({ id: p.id, name: p.title, coverUrl: p.coverUrl ?? null }))}
        artists={artists.map((a) => ({ id: a.id, name: a.name, slug: a.slug, avatarUrl: a.avatarUrl ?? null }))}
        likedCount={liked.length}
        incomingCount={incomingCount}
        messagesUnread={messagesUnread}
        isGuest={!userId}
        initialCollapsed={collapsed}
        user={
          userProfile
            ? {
                name: userProfile.name ?? session?.user?.name ?? 'Пользователь',
                avatarUrl: userProfile.image,
              }
            : undefined
        }
      />

      {/* suppressHydrationWarning: ScrollState вешает is-scrolling через classList — это поддерево
          гидрируется позже корня, ранний scroll даёт mismatch и ломает soft-навигацию роутера */}
      {/* [data-app-screen]-варианты: `_` между скобками = потомок ВНЕ :has() — так и нужно,
          футер и обёртка children соседи; :has(A B) молча сломает скрытие футера */}
      <div
        data-scroll-area
        data-desktop-pane
        suppressHydrationWarning
        className="flex min-w-0 flex-1 flex-col [&:has([data-app-screen])]:min-h-0 [&:has([data-app-screen])_[data-site-footer]]:hidden md:min-h-0 md:overflow-x-clip md:overflow-y-auto"
      >
        <div className="flex-1 [&:has([data-app-screen])]:min-h-0">{children}</div>
        <Footer />
      </div>
    </div>
  );
}

import { auth } from '@/auth';
import { getUserPlaylists, getFollowedArtists, getLikedTracks } from '@vire/db';
import { Footer } from '@/components/footer';
import { SidebarPrimaryNav } from '@/components/listener/sidebar-primary-nav';
import { LibrarySidebar } from '@/components/listener/library-sidebar';

export default async function ListenerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;

  const [playlists, artists, liked] = userId
    ? await Promise.all([
        getUserPlaylists(userId),
        getFollowedArtists(userId),
        getLikedTracks(userId),
      ])
    : [[], [], []];

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-[calc(100dvh-3rem-var(--player-h,0px))] w-64 shrink-0 flex-col self-start border-r border-border md:flex">
        <SidebarPrimaryNav />
        <LibrarySidebar
          playlists={playlists.map((p) => ({ id: p.id, name: p.title, coverUrl: p.coverUrl ?? null }))}
          artists={artists.map((a) => ({ id: a.id, name: a.name, slug: a.slug, avatarUrl: a.avatarUrl ?? null }))}
          likedCount={liked.length}
          isGuest={!userId}
        />
      </aside>

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </div>
  );
}

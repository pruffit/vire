import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/icon';
import { PlaylistCover } from '@/components/playlist-cover';
import { cn } from '@/lib/utils';
import { pluralTracks } from '@/lib/format';
import { CreatePlaylistButton } from './create-playlist-button';

type SidebarPlaylist = { id: string; name: string; coverUrl: string | null };
type SidebarArtist = { id: string; name: string; slug: string; avatarUrl: string | null };

export function LibrarySidebar({
  playlists,
  artists,
  likedCount,
  incomingCount = 0,
  isGuest,
  collapsed = false,
}: {
  playlists: SidebarPlaylist[];
  artists: SidebarArtist[];
  likedCount: number;
  incomingCount?: number;
  isGuest: boolean;
  collapsed?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!collapsed && (
        <div className="flex items-center justify-between px-3 pb-2 pt-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/35">
            Медиатека
          </span>
          {!isGuest && <CreatePlaylistButton variant="icon" />}
        </div>
      )}

      {isGuest ? (
        collapsed ? (
          <Link
            href="/sign-in"
            aria-label="Войти"
            title="Войти"
            className="mx-auto mt-2 grid h-10 w-10 place-items-center rounded-md text-foreground/55 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <Icon name="log-in" size={18} />
          </Link>
        ) : (
          <div className="mx-2 rounded-lg border border-border bg-foreground/[0.03] p-4 text-sm">
            <p className="text-foreground/70">Войди, чтобы собирать любимое и плейлисты.</p>
            <Link href="/sign-in" className="mt-2 inline-block text-sm font-medium text-foreground hover:underline">
              Войти →
            </Link>
          </div>
        )
      ) : (
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-2 [scrollbar-width:thin]',
            collapsed ? 'items-center px-2 pt-2' : 'px-1.5',
          )}
        >
          <LibraryRow
            collapsed={collapsed}
            href="/library/liked"
            title="Любимые треки"
            subtitle={`${likedCount} ${pluralTracks(likedCount)}`}
            leading={
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-linear-to-br from-foreground/20 to-foreground/[0.06]">
                <Icon name="heart" size={18} className="text-foreground" />
              </span>
            }
          />

          <LibraryRow
            collapsed={collapsed}
            href="/friends"
            title="Друзья"
            subtitle={incomingCount > 0 ? `${incomingCount} новых заявок` : 'Друзья'}
            badgeCount={incomingCount}
            leading={
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md bg-linear-to-br from-foreground/20 to-foreground/[0.06]">
                <Icon name="users" size={18} className="text-foreground" />
                {collapsed && incomingCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                )}
              </span>
            }
          />

          {playlists.map((p) => (
            <LibraryRow
              key={p.id}
              collapsed={collapsed}
              href={`/playlists/${p.id}`}
              title={p.name}
              subtitle="Плейлист"
              leading={
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-foreground/[0.06]">
                  <PlaylistCover
                    covers={p.coverUrl ? [p.coverUrl] : []}
                    title={p.name}
                    variant="single"
                    sizes="40px"
                    placeholderIconSize={18}
                  />
                </span>
              }
            />
          ))}

          {artists.map((a) => (
            <LibraryRow
              key={a.id}
              collapsed={collapsed}
              href={`/artists/${a.slug}`}
              title={a.name}
              subtitle="Артист"
              leading={
                a.avatarUrl ? (
                  <Image src={a.avatarUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground/[0.06] font-mono text-sm text-foreground/70">
                    {a.name[0]?.toUpperCase() ?? '?'}
                  </span>
                )
              }
            />
          ))}

          {playlists.length === 0 && artists.length === 0 && !collapsed && (
            <p className="px-2 py-3 text-xs text-foreground/40">Пока пусто. Лайкай треки и подписывайся на артистов.</p>
          )}
        </div>
      )}
    </div>
  );
}

function LibraryRow({
  href,
  title,
  subtitle,
  leading,
  badgeCount,
  collapsed = false,
}: {
  href: string;
  title: string;
  subtitle: string;
  leading: ReactNode;
  badgeCount?: number;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <Link
        href={href}
        title={`${title} · ${subtitle}`}
        aria-label={`${title}, ${subtitle}`}
        className="rounded-md p-1 transition-colors hover:bg-foreground/5"
      >
        {leading}
      </Link>
    );
  }

  return (
    <Link href={href} className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-foreground/5">
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground/90">{title}</span>
        <span className="block truncate text-xs text-foreground/40">{subtitle}</span>
      </span>
      {!!badgeCount && badgeCount > 0 && (
        <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-primary-foreground">
          {badgeCount}
        </span>
      )}
    </Link>
  );
}

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/icon';
import { pluralTracks } from '@/lib/format';

type SidebarPlaylist = { id: string; name: string; coverUrl: string | null };
type SidebarArtist = { id: string; name: string; slug: string; avatarUrl: string | null };

export function LibrarySidebar({
  playlists,
  artists,
  likedCount,
  isGuest,
}: {
  playlists: SidebarPlaylist[];
  artists: SidebarArtist[];
  likedCount: number;
  isGuest: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/35">
          Медиатека
        </span>
        {!isGuest && (
          <Link href="/library" aria-label="Все плейлисты" className="text-foreground/40 hover:text-foreground">
            <Icon name="plus" size={16} />
          </Link>
        )}
      </div>

      {isGuest ? (
        <div className="mx-2 rounded-lg bg-foreground/[0.04] p-4 text-sm">
          <p className="text-foreground/70">Войди, чтобы собирать любимое и плейлисты.</p>
          <Link href="/sign-in" className="mt-2 inline-block text-sm font-medium text-foreground hover:underline">
            Войти →
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 pb-2 [scrollbar-width:thin]">
          <LibraryRow
            href="/library#liked"
            title="Любимые треки"
            subtitle={`${likedCount} ${pluralTracks(likedCount)}`}
            leading={
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-gradient-to-br from-violet-500/70 to-sky-400/70">
                <Icon name="heart" size={16} className="text-white" />
              </span>
            }
          />

          {playlists.map((p) => (
            <LibraryRow
              key={p.id}
              href={`/playlists/${p.id}`}
              title={p.name}
              subtitle="Плейлист"
              leading={
                p.coverUrl ? (
                  <Image src={p.coverUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-foreground/10">
                    <Icon name="music" size={16} className="text-foreground/40" />
                  </span>
                )
              }
            />
          ))}

          {artists.map((a) => (
            <LibraryRow
              key={a.id}
              href={`/artists/${a.slug}`}
              title={a.name}
              subtitle="Артист"
              leading={
                a.avatarUrl ? (
                  <Image src={a.avatarUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground/10 font-mono text-sm">
                    {a.name[0]?.toUpperCase() ?? '?'}
                  </span>
                )
              }
            />
          ))}

          {playlists.length === 0 && artists.length === 0 && (
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
}: {
  href: string;
  title: string;
  subtitle: string;
  leading: ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-foreground/5">
      {leading}
      <span className="min-w-0">
        <span className="block truncate text-sm">{title}</span>
        <span className="block truncate text-xs text-foreground/40">{subtitle}</span>
      </span>
    </Link>
  );
}

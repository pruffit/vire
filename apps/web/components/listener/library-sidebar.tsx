'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { Icon } from '@/components/icon';
import { PlaylistCover } from '@/components/playlist-cover';
import { cn } from '@/lib/utils';
import { useChatUnread } from '@/lib/chat-unread';
import { CreatePlaylistButton } from './create-playlist-button';

type SidebarPlaylist = { id: string; name: string; coverUrl: string | null };
type SidebarArtist = { id: string; name: string; slug: string; avatarUrl: string | null };

export function LibrarySidebar({
  playlists,
  artists,
  likedCount,
  incomingCount = 0,
  messagesUnread = 0,
  isGuest,
  collapsed = false,
}: {
  playlists: SidebarPlaylist[];
  artists: SidebarArtist[];
  likedCount: number;
  incomingCount?: number;
  messagesUnread?: number;
  isGuest: boolean;
  collapsed?: boolean;
}) {
  const t = useTranslations('nav.sidebar');
  const tCommon = useTranslations('common');
  const liveMessagesUnread = useChatUnread(messagesUnread);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(!collapsed || !isGuest) && (
        <div
          className={cn(
            'flex items-center pb-2 pt-3',
            collapsed ? 'justify-center px-2' : 'justify-between px-3',
          )}
        >
          {!collapsed && (
            <span className="label-wide text-foreground/35">
              {t('library')}
            </span>
          )}
          {!isGuest && <CreatePlaylistButton variant="icon" />}
        </div>
      )}

      {isGuest ? (
        <div className={cn('flex flex-col gap-0.5', collapsed ? 'items-center px-2' : 'px-1.5')}>
          <JamRow collapsed={collapsed} title={t('jamTitle')} subtitle={t('jamSubtitle')} />
          {collapsed ? (
            <Link
              href="/sign-in"
              aria-label={t('signInAria')}
              title={t('signInAria')}
              className="mx-auto grid h-10 w-10 place-items-center rounded-md text-foreground/55 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <Icon name="log-in" size={18} />
            </Link>
          ) : (
            <div className="mt-1 rounded-lg border border-border bg-foreground/[0.03] p-4 text-sm">
              <p className="text-foreground/70">{t('guestPrompt')}</p>
              <Link href="/sign-in" className="mt-2 inline-block text-sm font-medium text-foreground hover:underline">
                {t('signInCta')}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            // overflow-x-clip обязателен рядом с overflow-y-auto: иначе ось X считается
            // как auto, и вылезающие за край бейджи/ring дают горизонтальную полосу.
            // no-scrollbar, а не scrollbar-width:thin — стандартное свойство переключает
            // Chromium на нативный скроллбар (со стрелками), игнорируя ::-webkit-* из globals.
            'flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-clip pb-2 no-scrollbar',
            collapsed ? 'items-center px-2' : 'px-1.5',
          )}
        >
          <LibraryRow
            collapsed={collapsed}
            href="/library/liked"
            title={t('likedTracks')}
            subtitle={tCommon('trackCount', { count: likedCount })}
            leading={
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-linear-to-br from-foreground/20 to-foreground/[0.06]">
                <Icon name="heart" size={18} className="text-foreground" />
              </span>
            }
          />

          <LibraryRow
            collapsed={collapsed}
            href="/friends"
            title={t('friends')}
            subtitle={incomingCount > 0 ? t('friendsNewRequests', { count: incomingCount }) : undefined}
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

          <LibraryRow
            collapsed={collapsed}
            href="/messages"
            title={t('messages')}
            subtitle={liveMessagesUnread > 0 ? t('messagesNew', { count: liveMessagesUnread }) : t('personalMessages')}
            badgeCount={liveMessagesUnread}
            leading={
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md bg-linear-to-br from-foreground/20 to-foreground/[0.06]">
                <Icon name="message-square" size={18} className="text-foreground" />
                {collapsed && liveMessagesUnread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                )}
              </span>
            }
          />

          {/* Джем — разовый сценарий, а не накопленное: стоит в общем списке после
              постоянных разделов, а не закреплён над ним. */}
          <JamRow collapsed={collapsed} title={t('jamTitle')} subtitle={t('jamSubtitle')} />

          {playlists.map((p) => (
            <LibraryRow
              key={p.id}
              collapsed={collapsed}
              href={`/playlists/${p.id}`}
              title={p.name}
              subtitle={t('playlist')}
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
              subtitle={t('artist')}
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
            <p className="px-2 py-3 text-xs text-foreground/40">{t('emptyLibrary')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function JamRow({ collapsed, title, subtitle }: { collapsed: boolean; title: string; subtitle: string }) {
  return (
    <LibraryRow
      collapsed={collapsed}
      href="/jam"
      title={title}
      subtitle={subtitle}
      leading={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-linear-to-br from-foreground/20 to-foreground/[0.06]">
          <Icon name="sliders" size={18} className="text-foreground" />
        </span>
      }
    />
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
  subtitle?: string;
  leading: ReactNode;
  badgeCount?: number;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <Link
        href={href}
        title={subtitle ? `${title} · ${subtitle}` : title}
        aria-label={subtitle ? `${title}, ${subtitle}` : title}
        className="inline-grid shrink-0 place-items-center rounded-md p-1 transition-colors hover:bg-foreground/5"
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
        {subtitle && <span className="block truncate text-xs text-foreground/40">{subtitle}</span>}
      </span>
      {!!badgeCount && badgeCount > 0 && (
        <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-primary-foreground">
          {badgeCount}
        </span>
      )}
    </Link>
  );
}

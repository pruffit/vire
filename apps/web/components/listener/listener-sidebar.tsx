'use client';

import { useCallback, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@/components/icon';
import { cn } from '@/lib/utils';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALES, type Locale } from '@vire/i18n/config';
import { SidebarPrimaryNav } from './sidebar-primary-nav';
import { LibrarySidebar } from './library-sidebar';
import { SidebarUser } from './sidebar-user';

type SidebarPlaylist = { id: string; name: string; coverUrl: string | null };
type SidebarArtist = { id: string; name: string; slug: string; avatarUrl: string | null };

/**
 * Левая панель слушателя (скролл — в соседнем <main>, см. (listener)/layout.tsx).
 * Состояние сворачивания в cookie — сервер рисует нужную ширину без вспышки гидрации.
 */
export function ListenerSidebar({
  playlists,
  artists,
  likedCount,
  incomingCount = 0,
  messagesUnread = 0,
  isGuest,
  initialCollapsed,
  user,
}: {
  playlists: SidebarPlaylist[];
  artists: SidebarArtist[];
  likedCount: number;
  incomingCount?: number;
  messagesUnread?: number;
  isGuest: boolean;
  initialCollapsed: boolean;
  user?: { name: string; avatarUrl: string | null };
}) {
  const t = useTranslations('nav.sidebar');
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = useCallback(() => {
    const next = LOCALES.find((l) => l !== locale) ?? locale;
    fetch('/api/v1/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {});
    router.replace(pathname, { locale: next });
  }, [locale, pathname, router]);

  const localeButton = (
    <button
      type="button"
      onClick={switchLocale}
      aria-label={t('switchLocaleAria', { target: locale === 'ru' ? t('localeEn') : t('localeRu') })}
      title={locale.toUpperCase()}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-xs font-medium text-foreground/45 transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      {locale.toUpperCase()}
    </button>
  );

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      const secure = location.protocol === 'https:' ? ';secure' : '';
      document.cookie = `vire_sidebar=${next ? 'rail' : 'full'};path=/;max-age=31536000;samesite=lax${secure}`;
      return next;
    });
  }, []);

  const toggleButton = (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? t('expandAria') : t('collapseAria')}
      title={collapsed ? t('expandTitle') : t('collapseTitle')}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-foreground/45 transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={18} />
    </button>
  );

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col overflow-hidden border-r border-border transition-[width] duration-200 ease-soft md:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className="pt-2">
        <SidebarPrimaryNav collapsed={collapsed} />
      </div>

      <LibrarySidebar
        playlists={playlists}
        artists={artists}
        likedCount={likedCount}
        incomingCount={incomingCount}
        messagesUnread={messagesUnread}
        isGuest={isGuest}
        collapsed={collapsed}
      />

      <div
        className={cn(
          'shrink-0 border-t border-border',
          collapsed ? 'flex flex-col items-center gap-1 px-2 py-2' : 'flex items-center gap-1 px-1.5 py-2',
        )}
      >
        {user ? (
          <SidebarUser
            name={user.name}
            avatarUrl={user.avatarUrl}
            collapsed={collapsed}
            className={collapsed ? undefined : 'min-w-0 flex-1'}
          />
        ) : (
          !collapsed && <span className="flex-1" aria-hidden />
        )}
        {localeButton}
        {toggleButton}
      </div>
    </aside>
  );
}

'use client';

import { useCallback, useState } from 'react';
import { Icon } from '@/components/icon';
import { cn } from '@/lib/utils';
import { SidebarPrimaryNav } from './sidebar-primary-nav';
import { LibrarySidebar } from './library-sidebar';
import { SidebarUser } from './sidebar-user';

type SidebarPlaylist = { id: string; name: string; coverUrl: string | null };
type SidebarArtist = { id: string; name: string; slug: string; avatarUrl: string | null };

/**
 * Левая оболочка слушателя: закреплённая flex-панель (см. (listener)/layout.tsx —
 * скролл живёт в соседнем <main>, не здесь). Сворачивается в узкий рейл с одними
 * миниатюрами/иконками. Состояние помним в cookie, чтобы сервер отрисовал нужную
 * ширину сразу (без вспышки гидрации) — начальное значение приходит пропом.
 *
 * Раскладка сверху вниз: навигация → медиатека (растёт и скроллится) → подвал
 * (профиль + тумблер сворачивания). Тумблер живёт в подвале, а не отдельной
 * строкой сверху — иначе над навигацией зияет пустая полоса с одинокой стрелкой.
 */
export function ListenerSidebar({
  playlists,
  artists,
  likedCount,
  isGuest,
  initialCollapsed,
  user,
}: {
  playlists: SidebarPlaylist[];
  artists: SidebarArtist[];
  likedCount: number;
  isGuest: boolean;
  initialCollapsed: boolean;
  user?: { name: string; avatarUrl: string | null };
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

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
      aria-label={collapsed ? 'Развернуть медиатеку' : 'Свернуть медиатеку'}
      title={collapsed ? 'Развернуть' : 'Свернуть'}
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
        {toggleButton}
      </div>
    </aside>
  );
}

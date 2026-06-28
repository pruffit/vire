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

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col overflow-hidden border-r border-border transition-[width] duration-200 ease-soft md:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className={cn('flex items-center px-3 pt-3 pb-1', collapsed ? 'justify-center' : 'justify-end')}>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Развернуть медиатеку' : 'Свернуть медиатеку'}
          title={collapsed ? 'Развернуть' : 'Свернуть'}
          className="grid place-items-center rounded-md p-1.5 text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={18} />
        </button>
      </div>

      <SidebarPrimaryNav collapsed={collapsed} />
      <LibrarySidebar
        playlists={playlists}
        artists={artists}
        likedCount={likedCount}
        isGuest={isGuest}
        collapsed={collapsed}
      />
      {user && <SidebarUser name={user.name} avatarUrl={user.avatarUrl} collapsed={collapsed} />}
    </aside>
  );
}

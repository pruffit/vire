import { Link } from '@/i18n/navigation';
import { auth } from '@/auth';
import { listUserArtists } from '@/lib/active-artist';
import { NavSearch } from './nav-search';
import { NavLink } from './nav-link';
import { NavSignOut } from './nav-sign-out';
import { Logo } from './logo';
import { Icon } from '@/components/icon';
import { NotificationBell } from '@/components/notifications/notification-bell';

export async function Nav() {
  const session = await auth();
  const user = session?.user;
  const isArtist = user?.role === 'ARTIST' || user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const isAdmin = user?.role === 'VIEWER' || user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  // членство (artist_members) проверяем только для VIEWER — не вешать запрос на каждого слушателя
  const showDashboard = isArtist || (user?.role === 'VIEWER' && (await listUserArtists(user.id)).length > 0);

  const displayName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Профиль';

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="VireMusic, на главную"
          className="shrink-0 hover:opacity-70 transition-opacity"
        >
          <Logo className="h-4 w-auto" />
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <NavSearch />
          {user ? (
            <>
              {showDashboard && (
                <NavLink href="/dashboard">
                  <span className="hidden sm:inline">Дашборд</span>
                  <span className="sm:hidden" aria-label="Дашборд"><DashboardIcon /></span>
                </NavLink>
              )}
              {isAdmin && (
                <NavLink href="/admin">
                  <span className="hidden sm:inline">Админка</span>
                  <span className="sm:hidden" aria-label="Админка"><AdminIcon /></span>
                </NavLink>
              )}
              <NotificationBell />
              <NavLink href="/profile">
                <span className="sm:hidden max-w-[72px] truncate block">{displayName}</span>
                <span className="hidden sm:block max-w-[140px] truncate">{user.name ?? user.email ?? 'Профиль'}</span>
              </NavLink>
              <span className="hidden sm:block"><NavSignOut /></span>
            </>
          ) : (
            <NavLink href="/sign-in">Войти</NavLink>
          )}
        </div>
      </div>
    </nav>
  );
}

function DashboardIcon() {
  return <Icon name="grid" size={16} />;
}

function AdminIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

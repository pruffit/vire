import Link from 'next/link';
import { auth } from '@/auth';
import { listUserArtists } from '@/lib/active-artist';
import { NavSearch } from './nav-search';
import { NavLink } from './nav-link';
import { NavSignOut } from './nav-sign-out';
import { Logo } from './logo';
import { Icon } from '@/components/icon';

export async function Nav() {
  const session = await auth();
  const user = session?.user;
  const isArtist = user?.role === 'ARTIST' || user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const isAdmin = user?.role === 'VIEWER' || user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  // «Дашборд» обычно совпадает с ролью артиста; read-only VIEWER может быть участником
  // артиста (artist_members) — для него (и только для него) проверяем членство, чтобы
  // не вешать запрос на каждого слушателя.
  const showDashboard = isArtist || (user?.role === 'VIEWER' && (await listUserArtists(user.id)).length > 0);

  const displayName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Профиль';

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          aria-label="Vire, на главную"
          className="shrink-0 hover:opacity-70 transition-opacity"
        >
          <Logo className="h-4 w-auto" />
        </Link>

        {/* Center: основная навигация */}
        <div className="hidden sm:flex items-center gap-0.5">
          <NavLink href="/artists">Артисты</NavLink>
          <NavLink href="/releases">Релизы</NavLink>
          {user && <NavLink href="/feed">Лента</NavLink>}
        </div>

        {/* Right side */}
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
              <NavLink href="/profile">
                <span className="sm:hidden max-w-[72px] truncate block">{displayName}</span>
                <span className="hidden sm:block max-w-[140px] truncate">{user.name ?? user.email ?? 'Профиль'}</span>
              </NavLink>
              <NavSignOut />
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

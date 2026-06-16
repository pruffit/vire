import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { NavSearch } from './nav-search';
import { NavLink } from './nav-link';
import { Logo } from './logo';
import { Icon } from '@/components/icon';

export async function Nav() {
  const session = await auth();
  const user = session?.user;
  const isArtist = user?.role === 'ARTIST' || user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const isAdmin = user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

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
          {user && <NavLink href="/feed">Лента</NavLink>}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <NavSearch />
          {user ? (
            <>
              {isArtist && (
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
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
              >
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  <SignOutIcon className="sm:hidden" />
                  <span className="hidden sm:inline">Выйти</span>
                </button>
              </form>
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

function SignOutIcon({ className }: { className?: string }) {
  return <Icon name="log-out" size={15} className={className} />;
}

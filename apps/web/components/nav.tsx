import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { NavSearch } from './nav-search';
import { NavLink } from './nav-link';

export async function Nav() {
  const session = await auth();
  const user = session?.user;
  const isArtist = user?.role === 'ARTIST' || user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  const displayName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Профиль';

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight shrink-0 hover:opacity-70 transition-opacity"
        >
          Vire
        </Link>

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
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

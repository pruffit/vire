import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { NavSearch } from './nav-search';

export async function Nav() {
  const session = await auth();
  const user = session?.user;
  const isArtist = user?.role === 'ARTIST' || user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-6 h-12 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight shrink-0 hover:opacity-70 transition-opacity"
        >
          Vire
        </Link>

        {/* Center links */}
        <div className="flex items-center gap-1">
          <NavLink href="/artists">Артисты</NavLink>
          {user && <NavLink href="/feed">Лента</NavLink>}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1 shrink-0">
          <NavSearch />
          {user ? (
            <>
              {isArtist && <NavLink href="/dashboard">Дашборд</NavLink>}
              <NavLink href="/profile">{user.name ?? user.email ?? 'Профиль'}</NavLink>
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
              >
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  Выйти
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
    >
      {children}
    </Link>
  );
}


import Link from 'next/link';
import { auth } from '@/auth';

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
          {user ? (
            <>
              {isArtist && <NavLink href="/dashboard">Дашборд</NavLink>}
              <span className="text-xs text-muted-foreground px-2 hidden sm:block truncate max-w-[120px]">
                {user.name ?? user.email}
              </span>
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

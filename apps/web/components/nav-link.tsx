'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Пункт навбара: подсвечивается и получает aria-current на своём разделе. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center px-2 sm:px-3 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? 'text-foreground bg-accent/40'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      }`}
    >
      {children}
    </Link>
  );
}

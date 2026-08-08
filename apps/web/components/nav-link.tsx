'use client';

import { Link, usePathname } from '@/i18n/navigation';

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

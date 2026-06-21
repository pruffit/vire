'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin', label: 'Обзор', exact: true },
  { href: '/admin/analytics', label: 'Аналитика' },
  { href: '/admin/users', label: 'Пользователи' },
  { href: '/admin/artists', label: 'Артисты' },
  { href: '/admin/tracks', label: 'Треки' },
  { href: '/admin/releases', label: 'Релизы' },
  { href: '/admin/system', label: 'Система' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex md:flex-col gap-1 md:gap-0.5 overflow-x-auto md:overflow-visible px-3 py-2.5 md:p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-md text-sm transition-colors ${
              active
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

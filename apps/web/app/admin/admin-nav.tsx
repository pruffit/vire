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
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
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

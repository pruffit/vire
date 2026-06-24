'use client';

import { SideNav, type SideNavItem } from '@/components/side-nav';

const NAV: SideNavItem[] = [
  { href: '/admin', label: 'Обзор', exact: true },
  { href: '/admin/analytics', label: 'Аналитика' },
  { href: '/admin/users', label: 'Пользователи' },
  { href: '/admin/artists', label: 'Артисты' },
  { href: '/admin/tracks', label: 'Треки' },
  { href: '/admin/releases', label: 'Релизы' },
  { href: '/admin/posts', label: 'Посты' },
  { href: '/admin/playlists', label: 'Плейлисты' },
  { href: '/admin/system', label: 'Система' },
];

export function AdminNav() {
  return <SideNav items={NAV} className="md:p-0" />;
}

'use client';

import { SideNav, type SideNavItem } from '@/components/side-nav';

const NAV: SideNavItem[] = [
  { href: '/dashboard', label: 'Обзор', icon: 'home', exact: true },
  { href: '/dashboard/posts', label: 'Анонсы', icon: 'bell' },
  { href: '/dashboard/links', label: 'Смартлинки', icon: 'link-2' },
  { href: '/dashboard/profile', label: 'Профиль', icon: 'user' },
];

/** Навигация дашборда артиста — общая оболочка `SideNav` с иконками. */
export function DashboardNav({ hasArtist }: { hasArtist: boolean }) {
  if (!hasArtist) return null;
  return <SideNav items={NAV} className="md:py-0" />;
}

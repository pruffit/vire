'use client';

import { SideNav, type SideNavItem } from '@/components/side-nav';

const NAV: SideNavItem[] = [
  { href: '/', label: 'Главная', icon: 'home', exact: true },
  { href: '/library', label: 'Медиатека', icon: 'music' },
];

export function SidebarPrimaryNav() {
  return <SideNav items={NAV} />;
}

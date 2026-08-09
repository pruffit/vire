'use client';

import { useTranslations } from 'next-intl';
import { SideNav, type SideNavItem } from '@/components/side-nav';

export function SidebarPrimaryNav({ collapsed = false }: { collapsed?: boolean }) {
  const t = useTranslations('nav.sidebar');
  const nav: SideNavItem[] = [
    { href: '/', label: t('home'), icon: 'home', exact: true },
    { href: '/library', label: t('library'), icon: 'music' },
  ];
  return <SideNav items={nav} collapsed={collapsed} />;
}

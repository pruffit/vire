'use client';

import { useTranslations } from 'next-intl';
import { SideNav, type SideNavItem } from '@/components/side-nav';

export function DashboardNav({ hasArtist }: { hasArtist: boolean }) {
  const t = useTranslations('dashboard.nav');
  if (!hasArtist) return null;
  const nav: SideNavItem[] = [
    { href: '/dashboard', label: t('overview'), icon: 'home', exact: true },
    { href: '/dashboard/posts', label: t('posts'), icon: 'bell' },
    { href: '/dashboard/links', label: t('links'), icon: 'link-2' },
    { href: '/dashboard/profile', label: t('profile'), icon: 'user' },
  ];
  return <SideNav items={nav} className="md:py-0" />;
}

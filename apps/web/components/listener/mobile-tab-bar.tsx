'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/icon';
import { isListenerShellPath } from '@/lib/listener-shell';
import { cn } from '@/lib/utils';

const TABS: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: '/', label: 'Главная', icon: 'home', exact: true },
  { href: '/search', label: 'Поиск', icon: 'search' },
  { href: '/library', label: 'Медиатека', icon: 'music' },
];

export function MobileTabBar() {
  const pathname = usePathname();
  if (!isListenerShellPath(pathname)) return null;

  return (
    <nav className="shrink-0 grid grid-cols-3 border-t border-border bg-background/95 backdrop-blur-sm md:hidden">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-2 text-[11px] transition-colors',
              active ? 'text-foreground' : 'text-foreground/45 hover:text-foreground',
            )}
          >
            <Icon name={t.icon} size={20} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

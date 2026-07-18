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
  { href: '/friends', label: 'Друзья', icon: 'users' },
];

export function MobileTabBar({ incomingCount = 0 }: { incomingCount?: number }) {
  const pathname = usePathname();
  if (!isListenerShellPath(pathname)) return null;

  return (
    <nav className="shrink-0 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur-sm md:hidden pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        const showBadge = t.href === '/friends' && incomingCount > 0;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors',
              active ? 'text-foreground' : 'text-foreground/45 hover:text-foreground',
            )}
          >
            <span className="relative">
              <Icon name={t.icon} size={20} />
              {showBadge && (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
                />
              )}
            </span>
            {t.label}
            {showBadge && <span className="sr-only">{incomingCount} новых заявок в друзья</span>}
          </Link>
        );
      })}
    </nav>
  );
}

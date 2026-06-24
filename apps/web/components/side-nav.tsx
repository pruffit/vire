'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/icon';
import { cn } from '@/lib/utils';

export interface SideNavItem {
  href: string;
  label: string;
  icon?: IconName;
  /** Активна только при точном совпадении пути (для корневого раздела). */
  exact?: boolean;
}

/**
 * Навигация продуктовой оболочки: вертикальный сайдбар на десктопе,
 * горизонтальный скролл-бар на мобилке. Активный пункт — по `usePathname`.
 * Общая для админки и дашборда артиста; иконки опциональны.
 */
export function SideNav({
  items,
  className,
}: {
  items: readonly SideNavItem[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex gap-1 overflow-x-auto px-3 py-2.5 md:flex-col md:gap-0.5 md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-foreground/10 font-medium text-foreground'
                : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground',
            )}
          >
            {item.icon && <Icon name={item.icon} size={16} className={active ? undefined : 'opacity-70'} />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

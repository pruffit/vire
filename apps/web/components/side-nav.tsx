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

/** Навигация оболочки (админка/дашборд): сайдбар на десктопе, скролл-бар на мобилке. */
export function SideNav({
  items,
  className,
  collapsed = false,
}: {
  items: readonly SideNavItem[];
  className?: string;
  /** Узкий рейл: только иконки по центру, подпись — в title (оболочка слушателя). */
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex gap-1 overflow-x-auto no-scrollbar px-3 py-2.5 md:flex-col md:gap-0.5 md:overflow-visible',
        collapsed && 'md:px-2',
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
            title={collapsed ? item.label : undefined}
            className={cn(
              'inline-flex shrink-0 items-center whitespace-nowrap rounded-md text-sm transition-colors',
              collapsed ? 'md:justify-center md:gap-0 md:px-0 md:py-2.5 gap-2.5 px-3 py-2' : 'gap-2.5 px-3 py-2',
              active
                ? 'bg-foreground/10 font-medium text-foreground'
                : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground',
            )}
          >
            {item.icon && <Icon name={item.icon} size={collapsed ? 18 : 16} />}
            <span className={cn(collapsed && 'md:hidden')}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

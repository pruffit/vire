'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Icon, type IconName } from '@/components/icon';
import { useChatUnread } from '@/lib/chat-unread';
import { isListenerShellPath } from '@/lib/listener-shell';
import { cn } from '@/lib/utils';

export function MobileTabBar({ incomingCount = 0, messagesUnread = 0 }: { incomingCount?: number; messagesUnread?: number }) {
  const t = useTranslations('nav.tabBar');
  const pathname = usePathname();
  const liveMessagesUnread = useChatUnread(messagesUnread);

  const tabs: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
    { href: '/', label: t('home'), icon: 'home', exact: true },
    { href: '/search', label: t('search'), icon: 'search' },
    { href: '/library', label: t('library'), icon: 'music' },
    { href: '/friends', label: t('friends'), icon: 'users' },
    { href: '/messages', label: t('messages'), icon: 'message-square' },
  ];

  if (!isListenerShellPath(pathname)) return null;

  return (
    <nav className="shrink-0 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur-sm md:hidden pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        const badgeCount = tab.href === '/friends' ? incomingCount : tab.href === '/messages' ? liveMessagesUnread : 0;
        const showBadge = badgeCount > 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors',
              active ? 'text-foreground' : 'text-foreground/45 hover:text-foreground',
            )}
          >
            <span className="relative">
              <Icon name={tab.icon} size={20} />
              {showBadge && (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
                />
              )}
            </span>
            <span className="max-w-full truncate leading-tight">{tab.label}</span>
            {showBadge && (
              <span className="sr-only">
                {tab.href === '/friends' ? t('friendRequestsSr', { count: badgeCount }) : t('messagesSr', { count: badgeCount })}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

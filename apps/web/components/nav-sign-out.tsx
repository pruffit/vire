'use client';

import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icon';

// клиентский signOut, не server action: ID экшена протухает у открытой вкладки после деплоя
export function NavSignOut() {
  const t = useTranslations('nav');
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
    >
      <Icon name="log-out" size={15} className="sm:hidden" />
      <span className="hidden sm:inline">{t('signOut')}</span>
    </button>
  );
}

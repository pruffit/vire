'use client';

import { signOut } from 'next-auth/react';
import { Icon } from '@/components/icon';

// Клиентский signOut (POST на стабильный /api/auth/signout) вместо инлайн
// server action: ID server action хэшируется от сборки и протухает у открытой
// вкладки после деплоя → «Failed to find Server Action». REST-эндпоинт иммунен.
export function NavSignOut() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
    >
      <Icon name="log-out" size={15} className="sm:hidden" />
      <span className="hidden sm:inline">Выйти</span>
    </button>
  );
}

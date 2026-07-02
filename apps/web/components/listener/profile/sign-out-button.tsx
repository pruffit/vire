'use client';

import { signOut } from 'next-auth/react';
import { Icon } from '@/components/icon';

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
    >
      Выйти из аккаунта <Icon name="log-out" size={14} />
    </button>
  );
}

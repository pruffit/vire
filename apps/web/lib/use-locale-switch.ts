'use client';

import { useCallback, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@vire/i18n/config';

// Провайдер next-intl и <html lang> живут в корневом app/layout.tsx — он общий для всех
// маршрутов и в дифф soft-навигации не входит, поэтому без refresh клиентские переводы
// остаются на прежней локали до перезагрузки.
export function useLocaleSwitch() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      fetch('/api/v1/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      }).catch(() => {});
      startTransition(() => {
        router.replace(pathname, { locale: next });
        router.refresh();
      });
    },
    [locale, pathname, router],
  );

  return { locale, switchLocale, pending };
}

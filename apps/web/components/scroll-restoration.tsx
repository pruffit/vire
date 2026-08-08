'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from '@/i18n/navigation';
import { getContentScrollArea } from '@/lib/scroll-area';

/**
 * Восстановление позиции скролла при навигации. Скролл живёт в `#main-content`
 * или `[data-scroll-area]` (см. `getContentScrollArea`), не в `window` (body —
 * overflow-hidden) — встроенный scroll-restoration Next трогает только окно.
 * Ключ карты — pathname без query, не переживает перезагрузку вкладки.
 */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const positions = new Map<string, number>();

// pathname динамический (/artists/*/releases/*/tracks/*) — карта иначе росла бы неограниченно
const MAX_REMEMBERED_ROUTES = 50;

function rememberPosition(pathname: string, top: number): void {
  // delete+set поднимает ключ в конец — вытесняем реже всего используемый, не самый старый
  positions.delete(pathname);
  positions.set(pathname, top);
  while (positions.size > MAX_REMEMBERED_ROUTES) {
    const oldest = positions.keys().next().value;
    if (oldest === undefined) break;
    positions.delete(oldest);
  }
}

export function ScrollRestoration() {
  const pathname = usePathname();

  // capture на document: scroll не всплывает, а активный скроллер меняется между маршрутами
  useEffect(() => {
    const onScroll = (e: Event) => {
      const el = e.target;
      if (el instanceof HTMLElement && (el.id === 'main-content' || el.hasAttribute('data-scroll-area'))) {
        rememberPosition(pathname, el.scrollTop);
      }
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [pathname]);

  useIsoLayoutEffect(() => {
    const el = getContentScrollArea();
    if (!el || window.location.hash) return;
    el.scrollTop = positions.get(pathname) ?? 0;
  }, [pathname]);

  return null;
}

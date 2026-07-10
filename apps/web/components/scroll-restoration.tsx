'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getContentScrollArea } from '@/lib/scroll-area';

/**
 * Восстановление позиции скролла при навигации.
 *
 * Скролл живёт в персистентном `#main-content` ИЛИ во внутренней панели оболочки
 * (`[data-scroll-area]` на десктопе слушателя/админки) — см. getContentScrollArea.
 * НЕ на `window` (body — overflow-hidden). Встроенное scroll-restoration Next трогает
 * только окно, поэтому при переходе назад позиция списка терялась — например,
 * зашёл в плейлист и вышел → выкидывало наверх. Здесь чиним вручную:
 *  - на каждый скролл запоминаем позицию текущего маршрута;
 *  - при входе на маршрут возвращаем сохранённую позицию (назад/вперёд по истории)
 *    или верх (новый переход);
 *  - ставим скролл в layout-effect — до отрисовки, без мигания;
 *  - якорные переходы (`#...`) не трогаем — пусть браузер ведёт к якорю.
 *
 * Ключ — pathname (без query): смена сортировки/фильтра в той же странице не
 * сбрасывает скролл. Карта живёт в памяти вкладки и не переживает перезагрузку.
 */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const positions = new Map<string, number>();

// Ключ — pathname, а он динамический (/artists/*/releases/*/tracks/*): за долгую
// сессию карта росла бы неограниченно. Держим только последние маршруты — назад
// пользователь ходит недалеко.
const MAX_REMEMBERED_ROUTES = 50;

function rememberPosition(pathname: string, top: number): void {
  // delete+set поднимает ключ в конец: вытесняем не самый старый по времени
  // создания, а реже всего используемый.
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

  // Запоминаем позицию текущего маршрута на каждый скролл. Слушаем в фазе захвата
  // на document: активный скроллер (общий или панель оболочки) меняется между
  // маршрутами, а scroll не всплывает — capture ловит его с любого элемента.
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

  // До отрисовки нового маршрута выставляем скролл: сохранённый (возврат) или верх.
  useIsoLayoutEffect(() => {
    const el = getContentScrollArea();
    if (!el || window.location.hash) return;
    el.scrollTop = positions.get(pathname) ?? 0;
  }, [pathname]);

  return null;
}

'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Восстановление позиции скролла при навигации.
 *
 * Скролл живёт в персистентном `#main-content` (app-shell, см. layout.tsx), а не
 * на `window` (body — overflow-hidden). Встроенное scroll-restoration Next трогает
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

export function ScrollRestoration() {
  const pathname = usePathname();

  // Запоминаем позицию текущего маршрута на каждый скролл.
  useEffect(() => {
    const el = document.getElementById('main-content');
    if (!el) return;
    const onScroll = () => positions.set(pathname, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pathname]);

  // До отрисовки нового маршрута выставляем скролл: сохранённый (возврат) или верх.
  useIsoLayoutEffect(() => {
    const el = document.getElementById('main-content');
    if (!el || window.location.hash) return;
    el.scrollTop = positions.get(pathname) ?? 0;
  }, [pathname]);

  return null;
}

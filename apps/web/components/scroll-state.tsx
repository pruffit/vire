'use client';

import { useEffect } from 'react';

/**
 * Гасит hover на контенте во время активной прокрутки — только на десктопе. Мышь
 * стоит на месте, а карточки проезжают под курсором, каждая ловит :hover и «дрожит»
 * (group-hover:scale/ring/тень). Пока скроллим, вешаем `is-scrolling` на скролл-элемент
 * (CSS глушит pointer-events у потомков), снимаем после паузы. На тач не трогаем —
 * там hover нет, а гашение pointer-events прервало бы жест скролла.
 */
export function ScrollState() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const onScroll = (e: Event) => {
      const el = e.target;
      // только контентные скролл-области, не внутренние списки вроде медиатеки в сайдбаре
      if (!(el instanceof HTMLElement)) return;
      if (el.id !== 'main-content' && !el.hasAttribute('data-scroll-area')) return;
      el.classList.add('is-scrolling');
      const prev = timers.get(el);
      if (prev) clearTimeout(prev);
      timers.set(
        el,
        setTimeout(() => {
          el.classList.remove('is-scrolling');
          timers.delete(el);
        }, 120),
      );
    };

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return null;
}

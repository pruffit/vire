'use client';

import { useEffect } from 'react';

/**
 * Гасит hover на контенте во время активной прокрутки — ТОЛЬКО на десктопе.
 *
 * На устройстве с мышью курсор стоит на месте, а карточки проезжают под ним
 * при колесе/трекпаде — каждая по очереди ловит :hover (group-hover:scale,
 * ring, тень, play-оверлей), из-за чего обложки «дрожат». Пока идёт скролл,
 * вешаем на #main-content класс `is-scrolling`; CSS глушит pointer-events
 * у потомков (не у самого контейнера — он должен продолжать скроллиться),
 * поэтому hover не срабатывает. Снимаем класс через короткую паузу после
 * остановки, так что обычный hover в покое работает как прежде.
 *
 * На тач-устройствах hover нет, а палец держит скролл ЧЕРЕЗ контент — гасить
 * pointer-events там нельзя (жест прервётся). Поэтому на не-hover устройствах
 * вообще ничего не вешаем (двойная защита: ещё и @media (hover) в CSS).
 *
 * Скролл-областей несколько (общий #main-content и панель <main data-scroll-area>
 * в оболочках слушателя/админки), и они монтируются/размонтируются при навигации.
 * Поэтому слушаем scroll в фазе ЗАХВАТА на document (scroll не всплывает, но в
 * capture доходит) и вешаем класс на сам проскролленный элемент — без переподписок.
 */
export function ScrollState() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Только устройства с настоящим hover (мышь/трекпад). Тач — пропускаем.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const onScroll = (e: Event) => {
      const el = e.target;
      // Только контентные скролл-области (общий #main-content или панель оболочки),
      // не внутренние списки вроде медиатеки в сайдбаре — иначе их элементы зря
      // теряют hit-testing при скролле списка.
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

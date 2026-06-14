'use client';

import { useEffect } from 'react';

/**
 * Гасит hover на контенте во время активной прокрутки.
 *
 * На десктопе курсор стоит на месте, а контент проезжает под ним при колесе/
 * трекпаде — каждая карточка по очереди ловит :hover (scale/ring/тень/оверлей),
 * из-за чего обложки и текст «дрожат». На тач-устройствах hover нет, поэтому
 * баг только на десктопе. Пока идёт скролл, вешаем на #main-content класс
 * `is-scrolling` (CSS глушит pointer-events у потомков → hover не срабатывает),
 * и снимаем его через короткую паузу после остановки.
 */
export function ScrollState() {
  useEffect(() => {
    const el = document.getElementById('main-content');
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      el.classList.add('is-scrolling');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('is-scrolling'), 120);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}

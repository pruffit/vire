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
 */
export function ScrollState() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Только устройства с настоящим hover (мышь/трекпад). Тач — пропускаем.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

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

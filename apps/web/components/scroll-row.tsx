'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@vire/ui';
import { useReduceMotionPref } from '@vire/ui/motion';
import { Icon } from '@/components/icon';

// Без композит-промоутеров (transform/backdrop-blur/постоянный opacity<1):
// слой внутри вертикальной скролл-области дрожит и перерастеризуется на каждый
// кадр скролла (см. память проекта scroll-jitter). Скрытие — display, не opacity.
// Кнопка — полновысотная краевая зона с градиентом-шторкой от фона страницы,
// видна при наведении на ленту или фокусе внутри неё (hover-устройства).
// z-50 + isolate на обёртке: у карточек внутри лент есть свои z-индексы (бейджи
// до z-40) — зона обязана рисоваться поверх них, а isolate не выпускает z-50 наружу.
// Непортальные абсолютные поповеры (add-to-playlist и т.п.) внутрь ленты не класть:
// isolate запрёт их под зонами, а overflow контейнера обрежет — только портал в body.
const EDGE_BUTTON =
  'absolute inset-y-0 z-50 hidden items-center text-foreground/70 transition-colors hover:text-foreground pointer-fine:group-hover/scroll-row:flex pointer-fine:group-focus-within/scroll-row:flex';

// Ширина зоны: узким пилюлям (чипы) w-14 закрывал бы целый элемент.
const EDGE_WIDTH = { sm: 'w-10', md: 'w-14' } as const;

// scroll-padding контейнера должен совпадать с его собственным padding — иначе
// снап первого элемента ложится не на 0, а на паддинг, и браузер сам доснапливает
// ленту к нему при простое (кнопка «влево» ошибочно видна на старте).
function syncSnapPadding(el: HTMLDivElement) {
  const style = getComputedStyle(el);
  el.style.scrollPaddingLeft = style.paddingLeft;
  el.style.scrollPaddingRight = style.paddingRight;
}

/**
 * Горизонтальная лента с прокруткой — обёртка над `overflow-x-auto no-scrollbar`.
 * Добавляет кнопки-шевроны (только hover-устройства, скрыты когда переполнения
 * в эту сторону нет) — на тач лента и так листается свайпом.
 */
export function ScrollRow({
  children,
  className,
  edgeZone = 'md',
}: {
  children: React.ReactNode;
  className?: string;
  edgeZone?: keyof typeof EDGE_WIDTH;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const reduceMotion = useReduceMotionPref();

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setOverflow(el.scrollWidth > el.clientWidth + 1);
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    syncSnapPadding(el);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(() => {
      syncSnapPadding(el);
      update();
    });
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update]);

  function scroll(dir: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    const elRect = el.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    // Координаты краёв детей в системе контента (не зависят от текущего scrollLeft
    // при чтении, но переводятся в него через + el.scrollLeft — getBoundingClientRect
    // даёт вьюпортные координаты, offsetLeft тут не годится для inline/flex-детей с гэпами).
    const edges = Array.from(el.children).map((child) => {
      const rect = child.getBoundingClientRect();
      return { left: rect.left - elRect.left + el.scrollLeft, right: rect.right - elRect.left + el.scrollLeft };
    });

    let target: number;
    if (dir === 1) {
      const next = edges.find((edge) => edge.right > el.scrollLeft + el.clientWidth + 1);
      target = next ? next.left - pad : el.scrollWidth;
      // Вырожденный случай (единственный ребёнок шире вьюпорта): якорь по границе
      // элемента не двигает скролл — листаем на вьюпорт.
      if (target <= el.scrollLeft) target = el.scrollLeft + el.clientWidth;
    } else {
      const next = edges.find((edge) => edge.left >= el.scrollLeft - el.clientWidth - 1);
      target = next ? next.left - pad : 0;
      if (target >= el.scrollLeft) target = el.scrollLeft - el.clientWidth;
    }
    el.scrollTo({ left: target, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  return (
    <div className="group/scroll-row relative isolate">
      {overflow && !atStart && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Прокрутить влево"
          className={cn(EDGE_BUTTON, EDGE_WIDTH[edgeZone], 'left-0 justify-start bg-linear-to-r from-background from-25% to-transparent')}
        >
          <Icon name="chevron-left" size={22} />
        </button>
      )}
      <div ref={scrollRef} className={cn('overflow-x-auto no-scrollbar', className)}>
        {children}
      </div>
      {overflow && !atEnd && (
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Прокрутить вправо"
          className={cn(EDGE_BUTTON, EDGE_WIDTH[edgeZone], 'right-0 justify-end bg-linear-to-l from-background from-25% to-transparent')}
        >
          <Icon name="chevron-right" size={22} />
        </button>
      )}
    </div>
  );
}

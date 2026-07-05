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
const EDGE_BUTTON =
  'absolute inset-y-0 z-10 hidden items-center text-foreground/60 transition-colors hover:text-foreground pointer-fine:group-hover/scroll-row:flex pointer-fine:group-focus-within/scroll-row:flex';

// Ширина зоны: узким пилюлям (чипы) w-14 закрывал бы целый элемент.
const EDGE_WIDTH = { sm: 'w-10', md: 'w-14' } as const;

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
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update]);

  function scroll(dir: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  return (
    <div className="group/scroll-row relative">
      {overflow && !atStart && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Прокрутить влево"
          className={cn(EDGE_BUTTON, EDGE_WIDTH[edgeZone], 'left-0 justify-start bg-linear-to-r from-background via-background/70 to-transparent')}
        >
          <Icon name="chevron-left" size={20} />
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
          className={cn(EDGE_BUTTON, EDGE_WIDTH[edgeZone], 'right-0 justify-end bg-linear-to-l from-background via-background/70 to-transparent')}
        >
          <Icon name="chevron-right" size={20} />
        </button>
      )}
    </div>
  );
}

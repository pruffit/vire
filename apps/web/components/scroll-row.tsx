'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@vire/ui';
import { useReduceMotionPref } from '@vire/ui/motion';
import { Icon } from '@/components/icon';

// Без композит-промоутеров (transform/backdrop-blur/постоянный opacity<1):
// слой внутри вертикальной скролл-области дрожит и перерастеризуется на каждый
// кадр скролла (см. память проекта scroll-jitter). Центрирование — top-калькой,
// фон непрозрачный, скрытие — display, не opacity.
const EDGE_BUTTON =
  'absolute top-[calc(50%-1rem)] z-10 hidden pointer-fine:grid place-items-center w-8 h-8 rounded-full border border-border bg-card text-foreground/70 shadow-sm transition-colors hover:text-foreground disabled:hidden';

/**
 * Горизонтальная лента с прокруткой — обёртка над `overflow-x-auto no-scrollbar`.
 * Добавляет кнопки-шевроны (только hover-устройства, скрыты когда переполнения
 * в эту сторону нет) — на тач лента и так листается свайпом.
 */
export function ScrollRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
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
    <div className="relative">
      {overflow && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          disabled={atStart}
          aria-label="Прокрутить влево"
          className={cn(EDGE_BUTTON, 'left-0')}
        >
          <Icon name="chevron-left" size={16} />
        </button>
      )}
      <div ref={scrollRef} className={cn('overflow-x-auto no-scrollbar', className)}>
        {children}
      </div>
      {overflow && (
        <button
          type="button"
          onClick={() => scroll(1)}
          disabled={atEnd}
          aria-label="Прокрутить вправо"
          className={cn(EDGE_BUTTON, 'right-0')}
        >
          <Icon name="chevron-right" size={16} />
        </button>
      )}
    </div>
  );
}

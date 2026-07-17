'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@vire/ui';
import { useReduceMotionPref } from '@vire/ui/motion';
import { Icon } from '@/components/icon';

// display, не opacity/transform: композит-слой внутри скролл-области дрожит на кадрах скролла
const EDGE_BUTTON = 'absolute inset-y-0 z-50 hidden items-center pointer-fine:flex';

// isolate + z-50 держит зону поверх бейджей карточек (z-40); непортальные поповеры
// (add-to-playlist и т.п.) внутрь ленты не класть — окажутся под зоной и обрежутся overflow
const EDGE_VARIANT = {
  zone: 'w-14 from-25% text-foreground/70 transition-colors hover:text-foreground',
  // chip: диск (28px) на from-55%, чтобы лежать на глухой части шторки, не на пилюле
  chip: 'group w-14 from-55%',
} as const;

// заливка, не бордер — контурный диск иначе сливается с контурными пилюлями чипов
const EDGE_DISC =
  'flex size-7 items-center justify-center rounded-full bg-foreground/10 text-foreground/80 transition-colors group-hover:bg-foreground/20 group-hover:text-foreground';

// scroll-padding должен совпадать с padding контейнера — иначе браузер доснапливает
// ленту к паддингу и кнопка «влево» ошибочно видна на старте
function syncSnapPadding(el: HTMLDivElement) {
  const style = getComputedStyle(el);
  el.style.scrollPaddingLeft = style.paddingLeft;
  el.style.scrollPaddingRight = style.paddingRight;
}

/** Отрицательные маргины-выпуски передавай в `bleedClassName`, не в `className` —
 *  иначе краевые зоны встанут не по настоящему визуальному краю ленты. */
export function ScrollRow({
  children,
  className,
  bleedClassName,
  edgeVariant = 'zone',
  edgeFrom = 'from-background',
}: {
  children: React.ReactNode;
  className?: string;
  bleedClassName?: string;
  edgeVariant?: keyof typeof EDGE_VARIANT;
  /** Цвет-шторка краевой зоны; если лента на приподнятой поверхности — передай её цвет. */
  edgeFrom?: string;
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
    // offsetLeft не годится для inline/flex-детей с гэпами — берём boundingClientRect
    const edges = Array.from(el.children).map((child) => {
      const rect = child.getBoundingClientRect();
      return { left: rect.left - elRect.left + el.scrollLeft, right: rect.right - elRect.left + el.scrollLeft };
    });

    let target: number;
    if (dir === 1) {
      const next = edges.find((edge) => edge.right > el.scrollLeft + el.clientWidth + 1);
      target = next ? next.left - pad : el.scrollWidth;
      // единственный ребёнок шире вьюпорта — якорь по его границе не двигает скролл
      if (target <= el.scrollLeft) target = el.scrollLeft + el.clientWidth;
    } else {
      const next = edges.find((edge) => edge.left >= el.scrollLeft - el.clientWidth - 1);
      target = next ? next.left - pad : 0;
      if (target >= el.scrollLeft) target = el.scrollLeft - el.clientWidth;
    }
    el.scrollTo({ left: target, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  return (
    <div className={cn('relative isolate', bleedClassName)}>
      {overflow && !atStart && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Прокрутить влево"
          className={cn(EDGE_BUTTON, EDGE_VARIANT[edgeVariant], 'left-0 justify-start bg-linear-to-r to-transparent', edgeFrom)}
        >
          {edgeVariant === 'chip' ? (
            <span className={EDGE_DISC}>
              <Icon name="chevron-left" size={15} />
            </span>
          ) : (
            <Icon name="chevron-left" size={22} />
          )}
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
          className={cn(EDGE_BUTTON, EDGE_VARIANT[edgeVariant], 'right-0 justify-end bg-linear-to-l to-transparent', edgeFrom)}
        >
          {edgeVariant === 'chip' ? (
            <span className={EDGE_DISC}>
              <Icon name="chevron-right" size={15} />
            </span>
          ) : (
            <Icon name="chevron-right" size={22} />
          )}
        </button>
      )}
    </div>
  );
}

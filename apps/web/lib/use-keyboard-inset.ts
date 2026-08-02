'use client';

import { useEffect, useState } from 'react';

function readInset(): number {
  const vv = typeof window === 'undefined' ? null : window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
}

/**
 * Сколько снизу перекрыто экранной клавиатурой. `fixed`-элементы живут в layout viewport,
 * который клавиатура не сжимает, — без этой поправки нижняя шторка уезжает под неё.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(readInset);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = (): void => setInset((prev) => {
      const next = readInset();
      return prev === next ? prev : next;
    });

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
  }, []);

  return inset;
}

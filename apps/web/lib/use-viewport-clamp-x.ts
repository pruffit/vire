'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { clampPanelX } from '@/lib/clamp-panel-x';

const PANEL_MARGIN = 8;

export function useViewportClampX(open: boolean): {
  panelRef: RefObject<HTMLDivElement | null>;
  offsetX: number;
} {
  const panelRef = useRef<HTMLDivElement>(null);
  const offsetXRef = useRef(0);
  const [offsetX, setOffsetX] = useState(0);

  // Меряем реальную позицию (за вычетом уже применённого сдвига) до пейнта — без видимого скачка.
  useLayoutEffect(() => {
    if (!open) return;
    function recalc() {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const offset = clampPanelX({
        panelLeft: rect.left - offsetXRef.current,
        panelWidth: rect.width,
        viewportWidth: window.innerWidth,
        margin: PANEL_MARGIN,
      });
      offsetXRef.current = offset;
      setOffsetX(offset);
    }
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('orientationchange', recalc);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('orientationchange', recalc);
    };
  }, [open]);

  return { panelRef, offsetX };
}

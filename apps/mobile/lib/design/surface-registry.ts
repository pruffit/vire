import { useEffect } from 'react';
import { GLASS_GREEN_MAX } from './glass-budget';

/**
 * Счётчик живых стеклянных поверхностей — только в dev.
 *
 * Тест (`lib/__tests__/design-system.test.ts`) стережёт **объявленную** модель бюджета;
 * этот счётчик стережёт **фактическую** и ловит расхождение между ними: новый экран,
 * лишняя панель, забытое подавление под листом.
 */
let live = 0;
let peak = 0;

export function useGlassSurfaceRegistration(active: boolean): void {
  useEffect(() => {
    if (!__DEV__ || !active) return;
    live += 1;
    if (live > peak) peak = live;
    if (live > GLASS_GREEN_MAX) {
      console.warn(
        `[vireglass] одновременных поверхностей с живым бэкдропом: ${live} — за пределами ` +
          `измеренной зелёной зоны (${GLASS_GREEN_MAX}). Ниже 7-й кадры проседают со 120 до 101.`,
      );
    }
    return () => {
      live -= 1;
    };
  }, [active]);
}

/** Для ручной диагностики со стенда и из логов. */
export function glassSurfaceStats(): { live: number; peak: number } {
  return { live, peak };
}

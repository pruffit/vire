// Системные настройки доступности (эталон `docs/vireglass/reference.md` §9): материал обязан
// слушать их сам, без участия экранов. Здесь только ЧТЕНИЕ системы; тумблер приложения
// подмешивается в `preferences.ts`, чтобы этот модуль ничего о приложении не знал.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { VireGlassAccessibility } from '../vireglass/accessibility';

export type SystemAccessibility = {
  reduceMotion: boolean;
  /** Настройка прозрачности есть только у iOS: на Android она остаётся выключенной. */
  reduceTransparency: boolean;
};

const OFF: SystemAccessibility = { reduceMotion: false, reduceTransparency: false };

export function useSystemAccessibility(): SystemAccessibility {
  const [state, setState] = useState<SystemAccessibility>(OFF);

  useEffect(() => {
    let alive = true;
    const put = (key: keyof SystemAccessibility) => (value: boolean) => {
      if (!alive) return;
      setState((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    };
    // Первый ответ приходит промисом, дальнейшие — событием: без первого настройка подхватится
    // только после того, как человек её переключит, то есть на уже открытом экране никогда.
    AccessibilityInfo.isReduceMotionEnabled().then(put('reduceMotion')).catch(() => {});
    AccessibilityInfo.isReduceTransparencyEnabled().then(put('reduceTransparency')).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', put('reduceMotion'));
    const transparency = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      put('reduceTransparency'),
    );
    return () => {
      alive = false;
      motion.remove();
      transparency.remove();
    };
  }, []);

  return state;
}

/**
 * Настройка приложения складывается с системной и может только УЖЕСТОЧИТЬ её: человек, который
 * попросил систему убрать движение, не должен получать его обратно из-за тумблера в ките.
 *
 * Увеличенный контраст модель знает, но у Android публичной настройки для него нет, поэтому
 * источника здесь пока нет — на вебе он приходит из системы.
 */
export function mergeAccessibility(
  system: SystemAccessibility,
  appReduceMotion: boolean,
): VireGlassAccessibility {
  return {
    reduceTransparency: system.reduceTransparency,
    increaseContrast: false,
    reduceMotion: system.reduceMotion || appReduceMotion,
  };
}

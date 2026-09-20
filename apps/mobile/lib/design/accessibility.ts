// Системные настройки доступности (эталон `docs/vireglass/reference.md` §9): материал обязан
// слушать их сам, без участия экранов. Здесь только ЧТЕНИЕ системы; тумблер приложения
// подмешивается в `preferences.ts`, чтобы этот модуль ничего о приложении не знал.
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import type { VireGlassAccessibility } from '../vireglass/accessibility';

export type SystemAccessibility = {
  reduceMotion: boolean;
  reduceTransparency: boolean;
  increaseContrast: boolean;
};

const OFF: SystemAccessibility = {
  reduceMotion: false,
  reduceTransparency: false,
  increaseContrast: false,
};

let state: SystemAccessibility = OFF;
const listeners = new Set<() => void>();
let subscriptions: { remove: () => void }[] = [];

function put(key: keyof SystemAccessibility, value: boolean): void {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  for (const notify of listeners) notify();
}

/** Контраст в системе называется по-разному: у Android это высококонтрастный текст, у iOS —
 *  затемнение системных цветов. Сигнал один, и материал отвечает на него одинаково. */
const CONTRAST =
  Platform.OS === 'ios'
    ? { read: () => AccessibilityInfo.isDarkerSystemColorsEnabled(), event: 'darkerSystemColorsChanged' as const }
    : { read: () => AccessibilityInfo.isHighTextContrastEnabled(), event: 'highTextContrastChanged' as const };

function start(): void {
  // Первый ответ приходит промисом, дальнейшие — событием: без первого настройка подхватится
  // только после того, как человек её переключит, то есть на уже открытом экране никогда.
  AccessibilityInfo.isReduceMotionEnabled().then((on) => put('reduceMotion', on)).catch(() => {});
  AccessibilityInfo.isReduceTransparencyEnabled().then((on) => put('reduceTransparency', on)).catch(() => {});
  CONTRAST.read().then((on) => put('increaseContrast', on)).catch(() => {});
  subscriptions = [
    AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => put('reduceMotion', on)),
    AccessibilityInfo.addEventListener('reduceTransparencyChanged', (on) => put('reduceTransparency', on)),
    AccessibilityInfo.addEventListener(CONTRAST.event, (on) => put('increaseContrast', on)),
  ];
}

function stop(): void {
  for (const subscription of subscriptions) subscription.remove();
  subscriptions = [];
}

/**
 * Подписка ОДНА на приложение, а не на поверхность: стеклянных деталей на экране до десятка
 * (`screens/glass-bench.tsx`), и своя пара запросов к мосту у каждой — заметная цена на ровном
 * месте. Нативные слушатели живут, пока есть хоть один читатель.
 */
export function subscribeToSystemAccessibility(listener: () => void): () => void {
  if (listeners.size === 0) start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const read = (): SystemAccessibility => state;

export function useSystemAccessibility(): SystemAccessibility {
  return useSyncExternalStore(subscribeToSystemAccessibility, read, read);
}

/**
 * Настройка приложения складывается с системной и может только УЖЕСТОЧИТЬ её: человек, который
 * попросил систему убрать движение, не должен получать его обратно из-за тумблера в ките.
 */
export function mergeAccessibility(
  system: SystemAccessibility,
  appReduceMotion: boolean,
): VireGlassAccessibility {
  return {
    reduceTransparency: system.reduceTransparency,
    increaseContrast: system.increaseContrast,
    reduceMotion: system.reduceMotion || appReduceMotion,
  };
}

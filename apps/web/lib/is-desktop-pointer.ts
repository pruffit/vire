import { useSyncExternalStore } from 'react';

/** Десктоп (мышь/трекпад) vs тач — по медиа `(hover: hover) and (pointer: fine)`, не userAgent (не врёт в мобильных вебвью). */
export function isDesktopPointer(): boolean {
  // SSR: window нет — по умолчанию показываем, на клиенте перепроверим.
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

const subscribeNoop = () => () => {};

/** useSyncExternalStore-обёртка над isDesktopPointer: на сервере true (показываем),
 *  на клиенте — реальный детект, без рассинхрона гидрации. */
export function useIsDesktopPointer(): boolean {
  return useSyncExternalStore(subscribeNoop, isDesktopPointer, () => true);
}

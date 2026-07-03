import { useSyncExternalStore } from 'react';

/**
 * Десктоп ли это (мышь/трекпад), а не планшет/телефон. Используется, чтобы
 * показывать ползунок громкости ТОЛЬКО на компьютере: на тач-устройствах
 * громкостью рулят хардварные кнопки, а экранный ползунок лишний (а на iOS ещё и
 * read-only — двигался бы вхолостую).
 *
 * Детект по медиа-запросу `(hover: hover) and (pointer: fine)` — оба true только
 * у устройств с точным указателем и наведением (десктоп/ноут). У телефонов и
 * планшетов указатель «грубый» (coarse) и hover нет. Не зависит от userAgent,
 * поэтому не врёт в мобильных браузерах/вебвью.
 */
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

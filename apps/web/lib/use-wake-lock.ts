'use client';

import { useEffect } from 'react';

/** Не даёт устройству-витрине погасить экран. Нет поддержки/отказ — тихо ничего не делаем. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const request = async (): Promise<void> => {
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        sentinel = null;
      }
    };

    // Блокировка снимается системой при уходе вкладки в фон — возвращаемся, берём заново.
    const reacquire = (): void => {
      if (!released && !document.hidden) void request();
    };

    void request();
    document.addEventListener('visibilitychange', reacquire);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', reacquire);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}

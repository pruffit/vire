import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fileStore } from '../storage/file-store';

/**
 * Настройки оформления из кита: тумблер стекла и приглушение движения.
 *
 * Тумблер стекла — не украшательство, а **аварийный выход**: конверт производительности
 * измерен на одном флагмане (`docs/vireglass/benchmarks/`), поведение на слабом железе
 * неизвестно. Выключение делает панели непрозрачными и снимает весь бэкдроп разом.
 */
interface PreferencesState {
  glassEnabled: boolean;
  reduceMotion: boolean;
  setGlassEnabled: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
  /** Сколько сейчас открыто листов. Пока > 0, нижние поверхности гасят живой бэкдроп. */
  openSheets: number;
  pushSheet: () => void;
  popSheet: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      glassEnabled: true,
      reduceMotion: false,
      openSheets: 0,
      setGlassEnabled: (glassEnabled) => set({ glassEnabled }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      pushSheet: () => set((s) => ({ openSheets: s.openSheets + 1 })),
      popSheet: () => set((s) => ({ openSheets: Math.max(0, s.openSheets - 1) })),
    }),
    {
      name: 'vire-preferences',
      storage: createJSONStorage(() => fileStore),
      // Счётчик листов — состояние сессии, а не настройка: переживать перезапуск ему
      // незачем, а восстановленный ненулевым он навсегда погасил бы стекло.
      partialize: (s) => ({ glassEnabled: s.glassEnabled, reduceMotion: s.reduceMotion }),
    },
  ),
);

/** Живой бэкдроп нужен, только когда стекло включено и поверх ничего не открыто. */
export function useBackdropEnabled(): boolean {
  return usePreferences((s) => s.glassEnabled && s.openSheets === 0);
}

export function useReduceMotion(): boolean {
  return usePreferences((s) => s.reduceMotion);
}

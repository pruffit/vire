import { createContext, useCallback, useContext, useState, type ReactNode, type RefObject } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { View } from 'react-native';

// Живой прогон (docs/features/mobile-app.md «Инкремент 21») нашёл нативный краш при
// оборачивании ВСЕГО навигатора в один `BlurTargetView` из expo-blur — конфликт её
// кастомного ViewGroup (переопределяет addView/removeView) с Fabric-рендерингом
// react-native-screens. Тот же живой прогон подтвердил: обёртка ТОЛЬКО вокруг контента
// одного экрана (лист, без вложенных Screen-контейнеров) не крашит и реально блюрит —
// без единого WARN про фолбэк на `none` в логе.
//
// Поэтому у каждого экрана — свой локальный `BlurTargetView` (через `useRegisterBlurTarget`
// ниже), а не один общий на всё приложение. Плавающие поверхности вне экрана (таб-бар,
// мини-плеер) должны блюрить контент ТЕКУЩЕГО сфокусированного экрана — какой именно ref
// это сейчас, хранится в общем контексте и переключается при смене фокуса.
type Ctx = { target: RefObject<View | null> | null; setTarget: (r: RefObject<View | null> | null) => void };
const BlurTargetContext = createContext<Ctx>({ target: null, setTarget: () => {} });

export function BlurTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<RefObject<View | null> | null>(null);
  return <BlurTargetContext.Provider value={{ target, setTarget }}>{children}</BlurTargetContext.Provider>;
}

/** Куда сейчас должны целиться `<Glass>`-поверхности вне текущего экрана (таб-бар, мини-плеер). */
export function useBlurTarget(): RefObject<View | null> | null {
  return useContext(BlurTargetContext).target;
}

/**
 * Регистрирует `ref` локального `BlurTargetView` экрана как общую цель блюра, пока экран
 * в фокусе — снимает регистрацию при потере фокуса (иначе таб-бар продолжит блюрить
 * content ушедшего со сцены экрана, а не текущего).
 */
export function useRegisterBlurTarget(ref: RefObject<View | null>): void {
  const { setTarget } = useContext(BlurTargetContext);
  useFocusEffect(
    useCallback(() => {
      setTarget(ref);
      return () => setTarget(null);
    }, [ref, setTarget]),
  );
}

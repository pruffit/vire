import {
  createContext,
  useCallback,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
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
type Target = RefObject<View | null> | null;
type Ctx = { target: Target; setTarget: Dispatch<SetStateAction<Target>> };
const BlurTargetContext = createContext<Ctx>({ target: null, setTarget: () => {} });

export function BlurTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target>(null);
  return <BlurTargetContext.Provider value={{ target, setTarget }}>{children}</BlurTargetContext.Provider>;
}

// `dimezisBlurView` рисует свою цель ВНУТРЬ себя. Если цель содержит сам BlurView, дерево
// RenderNode замыкается в цикл: `prepareTreeImpl` уходит в бесконечную рекурсию и рантайм
// падает переполнением стека (`SIGSEGV` в RenderThread, сотни кадров
// `prepareTreeImpl → prepareListAndChildren`). Ровно это и происходило с `<Glass>` внутри
// экрана: `Screen` оборачивает экран в `BlurTargetView` и его же регистрирует как общую
// цель, а `Glass` из того же экрана эту цель запрашивал — то есть собственного предка.
//
// Поэтому каждая цель объявляет вокруг своих детей область: потребителям ВНУТРИ неё она
// себя не отдаёт. Таб-бар и мини-плеер живут снаружи экранов и цель получают; стекло
// внутри экрана получает null и деградирует до полупрозрачной плашки без блюра — штатный
// фолбэк expo-blur.
const EnclosingTargetContext = createContext<Target>(null);

export function BlurTargetScope({ target, children }: { target: Target; children: ReactNode }) {
  return <EnclosingTargetContext.Provider value={target}>{children}</EnclosingTargetContext.Provider>;
}

/** Куда сейчас должны целиться `<Glass>`-поверхности вне текущего экрана (таб-бар, мини-плеер). */
export function useBlurTarget(): Target {
  const { target } = useContext(BlurTargetContext);
  const enclosing = useContext(EnclosingTargetContext);
  return target !== null && target === enclosing ? null : target;
}

/**
 * Регистрирует `ref` локального `BlurTargetView` экрана как общую цель блюра, пока экран
 * в фокусе — снимает регистрацию при потере фокуса (иначе таб-бар продолжит блюрить
 * content ушедшего со сцены экрана, а не текущего).
 *
 * Снятие обязано быть УСЛОВНЫМ. Порядок focus-эффекта нового экрана и cleanup'а старого
 * навигацией не гарантирован: при безусловном `setTarget(null)` уходящий экран стирает
 * цель, которую входящий уже успел записать, — и таб-бар остаётся вообще без блюра
 * (кнопки без преломления) до следующего переключения вкладки.
 */
export function useRegisterBlurTarget(ref: RefObject<View | null>): void {
  const { setTarget } = useContext(BlurTargetContext);
  useFocusEffect(
    useCallback(() => {
      setTarget(ref);
      return () => setTarget((current) => (current === ref ? null : current));
    }, [ref, setTarget]),
  );
}

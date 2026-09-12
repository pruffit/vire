import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { edgeStrength } from './design/scroll-edge';
import { scrollEdgeStyle, type ScrollEdgeStyle } from './vireglass/scroll-edge';

/**
 * Краевой эффект прокрутки (эталон `docs/vireglass/reference.md` §10) — работа ЭКРАНА: он
 * приглушает контент под нижней мебелью, и стекло видит уже готовый фон.
 *
 * Рисует эффект `components/furniture-scrim.tsx`, а знания, по которым он рисуется, живут
 * в разных местах дерева: прокрутка — внутри экрана, полярность мебели — в `GlassGroup`
 * таб-бара, то есть СНАРУЖИ экранов. Здесь они сходятся. Тот же приём, что у цели блюра
 * (`lib/blur-target.tsx`), и по той же причине.
 */
type EdgeApi = {
  strength: SharedValue<number>;
  inkLight: boolean;
  setInkLight: (light: boolean) => void;
};

const ScrollEdgeContext = createContext<EdgeApi | null>(null);

export function ScrollEdgeProvider({ children }: { children: ReactNode }) {
  // Сила едет shared value: прокрутка правит непрозрачность на UI-потоке, а React о ней
  // не знает вовсе — иначе каждый кадр прокрутки перерисовывал бы экран целиком.
  const strength = useSharedValue(1);
  const [inkLight, setInkLight] = useState(true);
  const api = useMemo<EdgeApi>(() => ({ strength, inkLight, setInkLight }), [strength, inkLight]);
  return <ScrollEdgeContext.Provider value={api}>{children}</ScrollEdgeContext.Provider>;
}

/**
 * Пропсы для ОСНОВНОГО вертикального списка экрана. Горизонтальные карусели и вложенные
 * списки не трогать: под мебель заезжает не их содержимое.
 */
export function useScrollEdge() {
  const strength = useContext(ScrollEdgeContext)?.strength;
  const seen = useRef({ scroll: 0, content: 0, layout: 0 });

  const push = useCallback(() => {
    if (!strength) return;
    const { scroll, content, layout } = seen.current;
    strength.value = edgeStrength(scroll, content, layout);
  }, [strength]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      seen.current = {
        scroll: contentOffset.y,
        content: contentSize.height,
        layout: layoutMeasurement.height,
      };
      push();
    },
    [push],
  );

  // Габариты приезжают раньше первой прокрутки и меняются после неё (подгрузка, раскрытие
  // секции): без них короткий список так и остался бы с полной силой.
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      seen.current.content = height;
      push();
    },
    [push],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      seen.current.layout = event.nativeEvent.layout.height;
      push();
    },
    [push],
  );

  // 32 мс, а не 16: событие идёт в JS-поток, а градиенту частота кадра не нужна — на глаз
  // ступеньки такой плотности неразличимы.
  return { onScroll, onContentSizeChange, onLayout, scrollEventThrottle: 32 };
}

/**
 * Экран без списка сам о себе не сообщит, и сила осталась бы от предыдущего — ровно то
 * залипание, от которого эффект и лечат. Полная сила — прежнее поведение; список экрана
 * тут же уточнит её замером.
 */
export function useScrollEdgeReset(): void {
  const strength = useContext(ScrollEdgeContext)?.strength;
  useFocusEffect(
    useCallback(() => {
      if (strength) strength.value = 1;
    }, [strength]),
  );
}

/** Полярность нижней мебели: доля живёт в `GlassGroup` и анимируется покадрово, наружу уходит
 *  только сторона — иначе переход полярности дёргал бы перерисовку скрима каждый кадр. */
export function useFurnitureInk(ink: number | undefined): void {
  const setInkLight = useContext(ScrollEdgeContext)?.setInkLight;
  const light = (ink ?? 1) > 0.5;
  useEffect(() => {
    setInkLight?.(light);
  }, [light, setInkLight]);
}

/** Чем и насколько красить край. Вне провайдера (стенды материала) — как раньше: полная сила. */
export function useScrollEdgePaint(): { strength: SharedValue<number> | null; style: ScrollEdgeStyle } {
  const api = useContext(ScrollEdgeContext);
  return { strength: api?.strength ?? null, style: scrollEdgeStyle(api?.inkLight ?? true) };
}

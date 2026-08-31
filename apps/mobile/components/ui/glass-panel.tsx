import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { VireGlassSurface } from '../vireglass/glass-surface';
import { useEnvironmentLight } from '../../lib/vireglass/environment';
import {
  resolveOptics,
  type VireGlassDebugMode,
  type VireGlassOptics,
} from '../../lib/vireglass/material';

const DEFAULT_OPTICS = resolveOptics();
import { radii } from '../../lib/design/scales';

/**
 * Прямоугольная стеклянная панель на том же материале, что и круглые кнопки навигации.
 *
 * До кита панели жили на отдельной системе (`components/glass.tsx`: плоский `BlurView` +
 * заливка), и настоящее преломление было видно только на четырёх кнопках таб-бара — то
 * есть материал, ради которого проделана вся работа, не показывался на самой заметной
 * поверхности продукта.
 *
 * Размер меряется `onLayout`, а не задаётся числом: панели тянутся по контенту и ширине
 * экрана. До первого замера рисуются только дети — одного кадра без стекла не видно, а
 * фиксированные размеры заставили бы каждого потребителя считать их самому.
 */
export function GlassPanel({
  children,
  radius = radii.glass,
  blurTarget,
  dim = 0,
  optics: opticsOverride,
  debug,
  style,
  contentStyle,
}: {
  children: ReactNode;
  radius?: number;
  /** Цель живого блюра — контент текущего экрана (`lib/blur-target.tsx`). */
  blurTarget?: RefObject<View | null> | null;
  /** Затемнение линзы: материал v2 почти не мутит фон, и текст на панели теряет контраст
   *  над светлой обложкой. Дешевле второго материала и не трогает оптику кромки. */
  dim?: number;
  /** Только для стенда материала: продукт всегда берёт дефолт. */
  optics?: VireGlassOptics;
  debug?: VireGlassDebugMode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    // Округляем: субпиксельные колебания при каждом рендере пересоздавали бы геометрию
    // и, вместе с ней, униформы шейдера.
    const next = { width: Math.round(width), height: Math.round(height) };
    setSize((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next));
  };

  const geometry = useMemo(
    () => (size ? { width: size.width, height: size.height, cornerRadius: radius } : null),
    [size, radius],
  );
  const optics = opticsOverride ?? DEFAULT_OPTICS;
  const light = useEnvironmentLight(optics.environment);

  // Панель неподвижна: деформации и нажатия у неё нет, но контракт поверхности требует
  // shared values — заводим постоянные нули.
  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const press = useSharedValue(0);
  const active = useSharedValue(0);

  return (
    <View style={[styles.host, { borderRadius: radius }, style]} onLayout={onLayout}>
      {geometry && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <VireGlassSurface
            geometry={geometry}
            optics={optics}
            dynamics={{ shiftX, shiftY, press, active, light }}
            blurTarget={blurTarget}
            dim={dim}
            debug={debug ?? 'normal'}
          />
        </View>
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { overflow: 'visible' },
  content: { flex: 1 },
});

import { useEffect, useMemo, type RefObject } from 'react';
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  BlurStyle,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkImage,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ICON_PATHS, type IconName } from '../lib/icon';
import { colors } from '../lib/theme';
import { VireGlassSurface } from './vireglass/glass-surface';
import { circleGeometry, surfacePadDp } from '../lib/vireglass/geometry';
import { useEnvironmentLight } from '../lib/vireglass/environment';
import {
  resolveMaterial,
  VIREGLASS_MATERIAL_V1,
  type VireGlassMaterial,
} from '../lib/vireglass/material';

const DRAG_LIMIT = 7;
const TAP_SLOP = 10;

const DRAG_SPRING = { mass: 1, damping: 28, stiffness: 340 };
const RELEASE_SPRING = { mass: 0.9, damping: 17, stiffness: 300 };
const PRESS_SPRING = { mass: 0.6, damping: 16, stiffness: 260 };

const DEFAULT_TINT = [0.4, 0.4, 0.44, 0.16] as const;

/** Жёсткое сопротивление: за палец капля идёт крайне неохотно — стекло, а не резинка.
 *  tanh(t / (LIMIT*4)) означает, что даже на 100 dp протяжки капля уезжает лишь на ~7 dp. */
function pull(t: number) {
  'worklet';
  return DRAG_LIMIT * Math.tanh(t / (DRAG_LIMIT * 4));
}

function rgba(hex: string): number[] {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

/** Иконка — маска в пикселях устройства (в dp мылила на 3x-экранах): белый штрих в зелёном
 *  канале, размытый красный ореол под ним — в альфе. Цвет штриха берётся в шейдере, поэтому
 *  активное состояние переходит плавно и не требует второго изображения. */
function useIconMask(name: IconName, box: number, iconSize: number, dpr: number): SkImage | null {
  return useMemo(() => {
    const px = Math.round(box * dpr);
    const surface = Skia.Surface.MakeOffscreen(px, px);
    if (!surface) return null;

    const canvas = surface.getCanvas();
    canvas.scale(dpr, dpr);

    const { translate, d } = ICON_PATHS[name];
    const scale = iconSize / 36;
    const path = Skia.Path.Make();
    d.forEach((segment) => {
      const p = Skia.Path.MakeFromSVGString(segment);
      if (p) path.addPath(p);
    });
    const m = Skia.Matrix();
    m.translate((box - iconSize) / 2, (box - iconSize) / 2);
    m.scale(scale, scale);
    m.translate(translate[0], translate[1]);
    path.transform(m);

    const stroke = (color: string, width: number) => {
      const paint = Skia.Paint();
      paint.setColor(Skia.Color(color));
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(width);
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      paint.setAntiAlias(true);
      return paint;
    };

    const halo = stroke('red', 2.75 * scale + 3.4);
    halo.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 3.0, true));
    canvas.drawPath(path, halo);
    canvas.drawPath(path, stroke('white', 2.75 * scale));

    surface.flush();
    // Снимок offscreen-поверхности GPU-текстурный и привязан к контексту JS-потока —
    // на рендер-треде Skia он невалиден, поэтому копируем в CPU-образ.
    const snap = surface.makeImageSnapshot();
    return snap.makeNonTextureImage() ?? snap;
  }, [name, box, iconSize, dpr]);
}

export function LiquidGlassButton({
  size,
  icon,
  active = false,
  onPress,
  blurTarget,
  ink = colors.foreground,
  inkActive = colors.foreground,
  tint = DEFAULT_TINT,
  material = VIREGLASS_MATERIAL_V1,
  dim = 0,
  style,
}: {
  size: number;
  icon: IconName;
  active?: boolean;
  onPress?: () => void;
  /** Цель живого блюра — контент текущего экрана (lib/blur-target.tsx). */
  blurTarget?: RefObject<View | null> | null;
  ink?: string;
  inkActive?: string;
  /** rgb + сила тонировки стекла (не заливка). Перекрывает тинт материала. */
  tint?: readonly [number, number, number, number];
  material?: VireGlassMaterial;
  /** Затемнение линзы под скрим экрана. */
  dim?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const dpr = PixelRatio.get();
  const geometry = useMemo(() => circleGeometry(size), [size]);
  const resolved = useMemo(
    () =>
      resolveMaterial({
        ...material,
        tint: { r: tint[0], g: tint[1], b: tint[2] },
        tintStrength: tint[3],
      }),
    [material, tint],
  );
  const box = size + surfacePadDp(geometry, DRAG_LIMIT) * 2;
  const mask = useIconMask(icon, box, Math.round(size * 0.42), dpr);

  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const press = useSharedValue(0);
  const lit = useSharedValue(active ? 1 : 0);
  const light = useEnvironmentLight(resolved.environment);
  useEffect(() => {
    lit.value = withTiming(active ? 1 : 0, { duration: 240 });
  }, [active, lit]);

  const iconLayer = useMemo(
    () => ({
      image: mask,
      scale: dpr,
      inkIdle: rgba(ink),
      inkActive: rgba(inkActive),
    }),
    [mask, dpr, ink, inkActive],
  );

  // Pan отвечает только за деформацию и на коротком тапе может вообще не активироваться,
  // поэтому нажатие — отдельный Tap, идущий одновременно с ним.
  const gesture = useMemo(() => {
    // runOnJS обязателен: ворклет-колбэки Pan в связке RNGH 2.32 + reanimated 4 молча не
    // выполняются (Tap при этом работает). Пружины всё равно крутятся на UI-потоке.
    const drag = Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin(() => {
        press.value = withSpring(1, PRESS_SPRING);
      })
      .onChange((e) => {
        shiftX.value = withSpring(pull(e.translationX), DRAG_SPRING);
        shiftY.value = withSpring(pull(e.translationY), DRAG_SPRING);
      })
      .onFinalize(() => {
        shiftX.value = withSpring(0, RELEASE_SPRING);
        shiftY.value = withSpring(0, RELEASE_SPRING);
        press.value = withSpring(0, PRESS_SPRING);
      });

    const tap = Gesture.Tap()
      .maxDistance(TAP_SLOP)
      .onEnd(() => {
        if (onPress) runOnJS(onPress)();
      });

    return Gesture.Simultaneous(drag, tap);
  }, [onPress, press, shiftX, shiftY]);

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} style={[styles.host, style]}>
        <VireGlassSurface
          geometry={geometry}
          material={resolved}
          dynamics={{ shiftX, shiftY, press, active: lit, light }}
          blurTarget={blurTarget}
          dragLimit={DRAG_LIMIT}
          icon={iconLayer}
          dim={dim}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  host: { overflow: 'visible' },
});

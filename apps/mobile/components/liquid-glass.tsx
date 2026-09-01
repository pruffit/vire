import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkImage,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ICON_PATHS, type IconName } from '../lib/icon';
import { colors } from '../lib/theme';
import { VireGlassSurface } from './vireglass/glass-surface';
import { circleGeometry, surfacePadDp } from '../lib/vireglass/geometry';
import { useGlassAdaptation, type BackdropSample } from '../lib/vireglass/adaptation';
import { useGlassGroup } from '../lib/vireglass/glass-group';
import { inkColor } from '../lib/vireglass/glass-ink';
import { useEnvironmentLight } from '../lib/vireglass/environment';
import {
  resolveOptics,
  type VireGlassOptics,
} from '../lib/vireglass/material';

const DEFAULT_OPTICS = resolveOptics();

/** Тёмный конец шкалы штриха. Кит держит светлый текст на `colors.foreground`; для
 *  обратной полярности нужен такой же «почти, но не совсем» тёмный. */
const INK_ON_LIGHT = '#14120f';

/** Ход тяги как доля размера детали. Фиксированные 12 dp на кнопке 68 dp не давали капле
 *  выйти за тело, и шейке было неоткуда взяться. */
const DRAG_LIMIT_RATIO = 0.62;
const TAP_SLOP = 10;

const DRAG_SPRING = { mass: 1, damping: 28, stiffness: 340 };
// Возврат намеренно недодемпфирован (ζ ≈ 0.5): капля проскакивает мимо покоя и качается
// назад. Это и есть отдача — критически задемпфированный возврат читается как «отпустило»,
// а не как упругий материал.
const RELEASE_SPRING = { mass: 0.9, damping: 17, stiffness: 300 };
const PRESS_SPRING = { mass: 0.6, damping: 16, stiffness: 260 };

/** Отдача в руку. Стекло — материал, а не картинка: касание обязано ощущаться, иначе
 *  вся упругость остаётся только на экране. Сбой тактильного движка глушим: на части
 *  устройств его нет вовсе, и падать из-за этого кнопка не должна. */
function tick(style: Haptics.ImpactFeedbackStyle) {
  Haptics.impactAsync(style).catch(() => {});
}

/** Жёсткое сопротивление: за палец капля идёт крайне неохотно — стекло, а не резинка.
 *  tanh(t / (LIMIT*4)) означает, что даже на 100 dp протяжки капля уезжает лишь на ~7 dp. */
function pull(t: number, limit: number) {
  'worklet';
  // Делитель 1.6, а не 4: при четырёх пальцу надо пройти четыре хода, чтобы вытянуть каплю
  // целиком, и на обычном движении она выходила из тела едва наполовину.
  return limit * Math.tanh(t / (limit * 1.6));
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

    // Один штрих и ничего под ним. Размытая тёмная подложка, которая тут стояла, читалась
    // грязным свечением вокруг каждого значка; разводить светлоту обязано тело стекла.
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
  ink,
  inkActive,
  optics: opticsProp = DEFAULT_OPTICS,
  dim = 0,
  style,
}: {
  size: number;
  icon: IconName;
  active?: boolean;
  onPress?: () => void;
  /** Цель живого блюра — контент текущего экрана (lib/blur-target.tsx). */
  blurTarget?: RefObject<View | null> | null;
  /** Цвет штриха. Не задан — кнопка ведёт его сама по тому, что лежит под стеклом:
   *  над светлой обложкой иконка темнеет, над тёмным списком светлеет. */
  ink?: string;
  inkActive?: string;
  optics?: VireGlassOptics;
  /** Затемнение линзы под скрим экрана. */
  dim?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const dpr = PixelRatio.get();
  // Полярность штриха ведёт сама кнопка: только она видит, что под ней лежит. Явно
  // заданный цвет её отключает — вызывающий знает свой контент лучше.
  const auto = ink === undefined && inkActive === undefined;
  // Внутри группы решение о полярности и оценка фона общие на весь блок: у каждой кнопки
  // под собой свой кусок фона, и по своему замеру одна уходит в тень, а соседняя остаётся
  // прозрачной — блок разваливается на отдельные детали.
  const group = useGlassGroup();
  const adaptation = useGlassAdaptation(opticsProp, { enabled: auto && group === null });
  const id = useId();
  const at = useRef({ x: 0, y: 0 });
  // Место детали приходит из onLayout уже после первого рендера. Шина тяги обязана его
  // знать, иначе чужая капля считается от нуля и приезжает не туда — поэтому раскладка
  // отмечается состоянием, а не только ссылкой.
  const [layoutTick, setLayoutTick] = useState(0);
  const inkValue = group?.ink ?? adaptation.ink;
  const groupProbe = group?.probeAt(at.current.x);
  // Место в шине тяги выдаётся один раз: по нему деталь отличает СВОЮ каплю от чужой.
  const seatRef = useRef(-1);
  if (seatRef.current < 0 && group) seatRef.current = group.claim();
  const seat = seatRef.current;
  const pullBus = useMemo(
    () =>
      group && seat > 0
        ? { bus: group.pull, seat, centerX: at.current.x, centerY: at.current.y }
        : undefined,
    [group, seat, layoutTick],
  );

  // Колбэк держится за сами методы, а не за объекты адаптации и группы: те пересоздаются на
  // каждом замере, и проп нативной вьюхи менялся бы впустую по нескольку раз в секунду.
  const { onBackdropSample } = adaptation;
  const report = group?.report;
  const onSample = useCallback(
    (e: { nativeEvent: BackdropSample }) => {
      if (report) report(id, at.current.x, at.current.y, e.nativeEvent, opticsProp.legibility);
      else onBackdropSample(e);
    },
    [report, id, onBackdropSample, opticsProp.legibility],
  );

  const release = group?.release;
  useEffect(() => {
    if (!release) return;
    return () => release(id);
  }, [release, id]);

  const optics = useMemo(
    () => (auto ? { ...opticsProp, ink: inkValue } : opticsProp),
    [opticsProp, auto, inkValue],
  );
  const strokeIdle = ink ?? inkColor(inkValue, colors.foreground, INK_ON_LIGHT);
  const strokeActive = inkActive ?? strokeIdle;
  const geometry = useMemo(() => circleGeometry(size), [size]);
  const dragLimit = size * DRAG_LIMIT_RATIO;
  const box = size + surfacePadDp(geometry, dragLimit) * 2;
  const mask = useIconMask(icon, box, Math.round(size * 0.42), dpr);

  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const press = useSharedValue(0);
  const lit = useSharedValue(active ? 1 : 0);
  const light = useEnvironmentLight(optics.environment);
  useEffect(() => {
    lit.value = withTiming(active ? 1 : 0, { duration: 240 });
  }, [active, lit]);

  const iconLayer = useMemo(
    () => ({
      image: mask,
      scale: dpr,
      inkIdle: rgba(strokeIdle),
      inkActive: rgba(strokeActive),
    }),
    [mask, dpr, strokeIdle, strokeActive],
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
        tick(Haptics.ImpactFeedbackStyle.Light);
      })
      .onChange((e) => {
        shiftX.value = withSpring(pull(e.translationX, dragLimit), DRAG_SPRING);
        shiftY.value = withSpring(pull(e.translationY, dragLimit), DRAG_SPRING);
      })
      .onFinalize(() => {
        shiftX.value = withSpring(0, RELEASE_SPRING);
        shiftY.value = withSpring(0, RELEASE_SPRING);
        press.value = withSpring(0, PRESS_SPRING);
      });

    const tap = Gesture.Tap()
      .maxDistance(TAP_SLOP)
      .onEnd(() => {
        // Вторая отдача — на срабатывании, и она заметнее первой: касание и действие это
        // разные события, и различать их на ощупь важнее, чем экономить вибрацию.
        runOnJS(tick)(Haptics.ImpactFeedbackStyle.Medium);
        if (onPress) runOnJS(onPress)();
      });

    return Gesture.Simultaneous(drag, tap);
  }, [onPress, press, shiftX, shiftY, dragLimit]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        style={[styles.host, style]}
        onLayout={(e) => {
          // Место кнопки в блоке: по нему группа строит плоскость светлоты, чтобы блок
          // темнел градиентно, а не ступенями по кнопкам.
          const { x, y, width: w, height: h } = e.nativeEvent.layout;
          at.current = { x: x + w / 2, y: y + h / 2 };
          setLayoutTick((v) => v + 1);
        }}
      >
        <VireGlassSurface
          geometry={geometry}
          optics={optics}
          dynamics={{ shiftX, shiftY, press, active: lit, light }}
          blurTarget={blurTarget}
          dragLimit={dragLimit}
          icon={iconLayer}
          dim={dim}
          onBackdropSample={auto ? onSample : undefined}
          groupProbe={groupProbe}
          pullBus={pullBus}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  host: { overflow: 'visible' },
});

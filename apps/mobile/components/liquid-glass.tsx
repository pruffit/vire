import { useEffect, useMemo, type RefObject } from 'react';
import { PixelRatio, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  BlurStyle,
  Canvas,
  ColorShader,
  Fill,
  ImageShader,
  PaintStyle,
  Shader,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkImage,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ICON_PATHS, type IconName } from '../lib/icon';
import { BlurView } from 'expo-blur';
import { colors } from '../lib/theme';
import { GlassLens as GlassLensNative, isGlassLensSupported } from '../modules/glass-lens';

// Оптика толстого стекла, а не шара. Профиль поверхности — ПЛОСКАЯ середина плюс фаска у
// кромки: полусфера (`z = sqrt(1 - r²)`) гнёт всё поле зрения и потому неизбежно читается
// мыльным пузырём. Шейдер рисует только саму поверхность (тень, фаска, Френель, блик,
// кромка, иконка, деформация) и оставляет середину почти пустой: фон под ней — живой
// BlurView, выровненный с контентом попиксельно, а не снимок экрана.
function compile(src: string) {
  const effect = Skia.RuntimeEffect.Make(src);
  if (!effect) throw new Error('liquid-glass: SKSL не скомпилировался');
  return effect;
}

const SOURCE = compile(`
uniform shader u_icon;

uniform float2 u_center;
uniform float  u_radius;
uniform float2 u_shift;
uniform float2 u_dir;
uniform float  u_stretch;
uniform float  u_press;
uniform float  u_active;
uniform float  u_iconScale;
uniform float4 u_tint;
uniform float4 u_inkIdle;
uniform float4 u_inkActive;

const float BEVEL = 0.18;
const float ICON_LAG = 0.5;
const float SHADOW_R = 1.62;
const float SHADOW_DROP = 0.16;

half4 main(float2 xy) {
  float2 KEY = normalize(float2(-0.6, -1.0));

  float2 q = xy - u_center - u_shift;

  // Обратная деформация: вдоль вектора тяги растяжение A, поперёк сжатие 1/sqrt(A).
  // Закон намеренно симметричный — ровно его повторяет трансформ живой подложки под
  // канвасом (lensStyle), иначе стекло и фон под ним разъезжаются при перетаскивании.
  // По этой же координате семплируется иконка, поэтому она мнётся вместе со стеклом.
  if (u_stretch > 0.001) {
    float along = dot(q, u_dir);
    float2 perp = q - u_dir * along;
    float A = 1.0 + u_stretch;
    q = u_dir * (along / A) + perp * sqrt(A);
  }
  q *= 1.0 - u_press * 0.05;

  float R = u_radius;
  float dist = length(q);
  float r = dist / R;
  float feather = 1.0 / R;
  if (r > SHADOW_R) { return half4(0.0); }

  // Тень и ореол активной живут СНАРУЖИ круга: внутри их место занимает само стекло, а
  // линза под канвасом — нативная вьюха, дотянуться до неё отсюда нечем. Отрыв кнопки от
  // контента держится именно на тени: без неё круг лежит НА картинке, а не над ней.
  float outside = smoothstep(1.0 - feather, 1.0 + feather * 2.0, r);
  float amb = 1.0 - smoothstep(0.55, SHADOW_R, length(q - float2(0.0, R * SHADOW_DROP)) / R);
  float con = 1.0 - smoothstep(0.96, 1.18, r);
  float shade = (amb * amb * 0.34 + con * con * 0.22) * outside;
  float halo = 1.0 - smoothstep(1.0, 1.28, r);
  halo = halo * halo * u_active * 0.10 * outside;

  if (r > 1.0 + feather) {
    return half4(half3(halo), half(halo + shade * (1.0 - halo)));
  }

  float rc = min(r, 1.0);
  float2 nd = dist > 0.001 ? q / dist : float2(0.0, -1.0);

  float t = clamp((rc - (1.0 - BEVEL)) / BEVEL, 0.0, 1.0);
  float slope = min(t * t * inversesqrt(max(1.0 - t * t * 0.94, 0.02)), 3.2);
  float3 N = normalize(float3(nd * slope, 1.0));

  float bloom = 1.0 + u_press * 0.45;
  float lift = 1.0 + u_active * 0.85;

  float3 V = float3(0.0, 0.0, 1.0);
  float3 L1 = normalize(float3(-0.55, -0.78, 0.40));
  float3 L2 = normalize(float3(0.60, 0.66, 0.42));
  float bevelMask = smoothstep(0.10, 0.55, t);
  float s1 = pow(max(dot(reflect(-L1, N), V), 0.0), 55.0) * 0.80;
  float s2 = pow(max(dot(reflect(-L2, N), V), 0.0), 80.0) * 0.12;
  float spec = (s1 + s2) * bevelMask * bloom * (1.0 + u_active * 0.30);

  // Кромка — не ровное кольцо (оно читается нарисованным контуром), а две дуги: яркая
  // сверху-слева по ключевому свету и слабая снизу от отражённого. Бока остаются тёмными,
  // и именно этот перепад по кругу глаз опознаёт как стекло на чёрном фоне.
  float facing = dot(nd, KEY);
  float edge = smoothstep(0.90, 0.985, rc);
  float arcTop = pow(max(facing, 0.0), 1.5) * 0.62;
  float arcBot = pow(max(-facing, 0.0), 4.0) * 0.10;
  float rimLum = edge * (arcTop + arcBot) * bloom * lift;
  // Дисперсия микроскопическая и только в кромке: ключевой блик холодный, отражённый
  // тёплый. Ровно столько, чтобы край не читался напечатанным контуром.
  half3 rimCol = (half3(arcTop) * half3(0.95, 0.975, 1.0) + half3(arcBot) * half3(1.0, 0.96, 0.90))
    * half(edge * bloom * lift);

  // Полоса поглощения там, где кромку не освещает ни один источник, — толщина стекла.
  float absorb = smoothstep(0.72, 0.94, rc) * (1.0 - smoothstep(0.94, 1.0, rc)) * (1.0 - abs(facing)) * 0.07;

  half3 col = half3(u_tint.rgb);

  // Тинт СВЕТЛЫЙ и слабый, а не тёмный: тёмное стекло на чёрном контенте исчезает и
  // кнопку приходится держать жирной кромкой — от этого она читается хромированной бусиной.
  // Фаска плотная, середина почти пустая — сквозь неё видно живой фон BlurView под канвасом.
  float body = mix(0.03, 0.11, smoothstep(0.10, 0.62, t));
  float vignette = (1.0 - smoothstep(0.0, 0.85, rc)) * 0.03;
  float a = max(body, vignette) + u_press * 0.05;

  // Активная отличается не заливкой, а плотностью стекла, яркостью кромки, ореолом и
  // полной яркостью иконки — светлая шайба рядом с тёмными кнопками выбивается из ряда.
  col = mix(col, half3(0.58, 0.58, 0.61), half(u_active * 0.40));
  a = max(a, u_active * 0.26) + absorb;
  col *= 1.0 - half(absorb * 1.2);

  col += half3(spec) * half3(0.98, 0.99, 1.0);
  col += rimCol;

  float2 ip = u_center + q + u_shift * (1.0 - ICON_LAG);
  half4 ink = u_icon.eval(ip * u_iconScale);
  // Маска двухслойная: сам штрих — белый (зелёный канал), под ним размытый красный ореол.
  // Разность каналов даёт тень под иконкой — без неё светлый штрих тонет в светлой обложке,
  // а гасить ради него ВСЮ линзу виньеткой значит убить преломление.
  half halation = ink.a - ink.g;
  col *= 1.0 - halation * 0.92;
  a = max(a, float(halation) * 0.72);
  half inkA = ink.g * half(mix(0.82, 1.0, u_active));
  half3 inkCol = mix(half3(u_inkIdle.rgb), half3(u_inkActive.rgb), half(u_active));
  col = col * (1.0 - inkA) + inkCol * inkA;

  // Альфа кромки и блика идёт вровень с их яркостью: при заниженной альфе premultiplied
  // результат гаснет и край становится невидимым на тёмном фоне.
  a = clamp(a + spec + rimLum, 0.0, 1.0);
  a = max(a, float(inkA));
  a *= 1.0 - smoothstep(1.0 - feather, 1.0 + feather, r);

  col = clamp(col, half3(0.0), half3(1.0));
  return half4(col * half(a), half(a + shade * (1.0 - a)));
}
`);

/** Запас вокруг круга в долях диаметра: канвас Skia режет всё за своим прямоугольником —
 *  без запаса обрезаются и растянутая капля, и внешняя тень (`SHADOW_R` радиусов). */
const PAD_RATIO = 0.44;
const DRAG_LIMIT = 7;
const MAX_STRETCH = 0.17;
const TAP_SLOP = 10;
/** Увеличение живого фона = преломление толстого стекла. Масштабируется маленький слой,
 *  центрированный по линзе: его layout-позиция совпадает с центром кнопки, поэтому выборка
 *  блюра не уезжает (равномерный трансформ на полноразмерном слое её уводил). */
const LOUPE = 1.75;

/** Параметры настоящего преломления (modules/glass-lens). `BEVEL` тот же, что у шейдера
 *  поверхности — иначе подложка и нарисованная поверх кромка описывают разные стёкла. */
const BEVEL = 0.18;
const MAGNIFY = 1.22;
const EDGE_REACH = 1.3;
const CHROMA = 1.2;
const SPHERICAL = 1.2;
/** Во сколько раз вьюха линзы больше кнопки: выборка у кромки уходит на `EDGE_REACH`
 *  радиусов, и за пределами вьюхи шейдеру нечего семплировать. */
const OVERSCAN = 1.55;

const refracting = isGlassLensSupported && GlassLensNative !== null;

const DEFAULT_TINT = [0.40, 0.40, 0.44, 0.16] as const;

const DRAG_SPRING = { mass: 1, damping: 28, stiffness: 340 };
const RELEASE_SPRING = { mass: 0.9, damping: 17, stiffness: 300 };
const PRESS_SPRING = { mass: 0.6, damping: 16, stiffness: 260 };

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
  /** rgb + сила тонировки стекла (не заливка). */
  tint?: readonly [number, number, number, number];
  /** Затемнение линзы под скрим экрана: BlurView целится в контент напрямую и затемняющей
   *  подложки над ним не видит — без этого линза светится дыркой в скриме. */
  dim?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const dpr = PixelRatio.get();
  const pad = Math.ceil(size * PAD_RATIO);
  const overscan = Math.round(size * OVERSCAN);
  const box = size + pad * 2;
  const mask = useIconMask(icon, box, Math.round(size * 0.42), dpr);

  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const press = useSharedValue(0);
  const lit = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    lit.value = withTiming(active ? 1 : 0, { duration: 240 });
  }, [active, lit]);

  const inkIdle = useMemo(() => rgba(ink), [ink]);
  const inkOn = useMemo(() => rgba(inkActive), [inkActive]);
  const tintVec = useMemo(() => [...tint], [tint]);

  // Живая подложка обязана повторять деформацию стекла: она нативная вьюха, шейдер её не
  // гнёт, поэтому тот же закон применяется трансформом.
  const lensStyle = useAnimatedStyle(() => {
    const dx = shiftX.value;
    const dy = shiftY.value;
    const len = Math.sqrt(dx * dx + dy * dy);
    const stretch = Math.min(len / DRAG_LIMIT, 1) * MAX_STRETCH;
    const along = 1 + stretch;
    const angle = len > 0.001 ? Math.atan2(dy, dx) : 0;
    const bulge = 1 + press.value * 0.05;
    return {
      transform: [
        { translateX: dx },
        { translateY: dy },
        { rotate: angle + 'rad' },
        { scaleX: along * bulge },
        { scaleY: (1 / Math.sqrt(along)) * bulge },
        { rotate: -angle + 'rad' },
      ],
    };
  });

  const uniforms = useDerivedValue(() => {
    const dx = shiftX.value;
    const dy = shiftY.value;
    const len = Math.sqrt(dx * dx + dy * dy);
    const inv = len > 0.001 ? 1 / len : 0;
    return {
      u_center: [box / 2, box / 2],
      u_radius: size / 2,
      u_shift: [dx, dy],
      u_dir: [dx * inv, dy * inv],
      u_stretch: Math.min(len / DRAG_LIMIT, 1) * MAX_STRETCH,
      u_press: press.value,
      u_active: lit.value,
      u_iconScale: dpr,
      u_tint: tintVec,
      u_inkIdle: inkIdle,
      u_inkActive: inkOn,
    };
  }, [box, size, dpr, tintVec, inkIdle, inkOn]);

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
      <View
        collapsable={false}
        style={[styles.host, style, { width: size, height: size }]}
      >
        {/* Живой фон линзы. Снимок экрана (makeImageFromView) для этого не годится в принципе:
            замер на эмуляторе — ~1000 мс на кадр, то есть любое преломление по нему отстаёт.
            BlurView с blurTarget рисует контент экрана покадрово нативно. */}
        <Animated.View style={[styles.lens, { width: size, height: size }, lensStyle]}>
          {/* BlurView рисует свой собственный прямоугольник — выравнивание с контентом
              точное по построению, без задержки и без вычисления смещений. Монтируем только
              с готовой целью: без неё он при инициализации навсегда падает в фолбэк «none». */}
          {blurTarget?.current ? (
            refracting && GlassLensNative ? (
              // Настоящее преломление: AGSL-шейдер семплирует уже отрисованный блюр по
              // смещённой координате (modules/glass-lens). Вьюха НАМЕРЕННО больше круга —
              // у кромки выборка уходит за его пределы, круг вырезает сам шейдер.
              <GlassLensNative
                lensRadius={size / 2}
                bevel={BEVEL}
                magnify={MAGNIFY}
                edgeReach={EDGE_REACH}
                chroma={CHROMA}
                spherical={SPHERICAL}
                style={{ position: 'absolute', width: overscan, height: overscan }}
              >
                <BlurView
                  intensity={9}
                  tint="dark"
                  blurMethod="dimezisBlurView"
                  blurTarget={blurTarget}
                  style={StyleSheet.absoluteFill}
                />
              </GlassLensNative>
            ) : (
              // Фолбэк ниже Android 13: равномерное увеличение. Это лупа, а не линза —
              // радиально переменного смещения аффинным трансформом не выразить.
              <View style={[styles.clip, { width: size, height: size, borderRadius: size / 2 }]}>
                <View
                  style={{
                    position: 'absolute',
                    left: (size * (1 - 1 / LOUPE)) / 2,
                    top: (size * (1 - 1 / LOUPE)) / 2,
                    width: size / LOUPE,
                    height: size / LOUPE,
                    transform: [{ scale: LOUPE }],
                  }}
                >
                  <BlurView
                    intensity={9}
                    tint="dark"
                    blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
                    blurTarget={blurTarget}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              </View>
            )
          ) : null}
          {dim > 0 ? (
            <View
              style={{
                position: 'absolute',
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colors.background,
                opacity: dim,
              }}
            />
          ) : null}
        </Animated.View>
        <Canvas style={[styles.canvas, { width: box, height: box, left: -pad, top: -pad }]}>
          <Fill>
            <Shader source={SOURCE} uniforms={uniforms}>
              {mask ? (
                <ImageShader image={mask} tx="decal" ty="decal" />
              ) : (
                <ColorShader color="#00000000" />
              )}
            </Shader>
          </Fill>
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  host: { overflow: 'visible' },
  lens: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  clip: { position: 'absolute', overflow: 'hidden' },
  canvas: { position: 'absolute' },
});

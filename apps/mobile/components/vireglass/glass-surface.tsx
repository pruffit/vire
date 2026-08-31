import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  findNodeHandle,
  PixelRatio,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Canvas,
  ColorShader,
  Fill,
  ImageShader,
  Shader,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { GlassLens as GlassLensNative, isGlassLensSupported } from '../../modules/glass-lens';
import {
  lensMagnify,
  toLensProps,
  toSurfaceUniforms,
  type VireGlassMorph,
} from '../../lib/vireglass/adapters';
import {
  lensPadDp,
  surfacePadDp,
  type VireGlassGeometry,
} from '../../lib/vireglass/geometry';
import type { BackdropSample } from '../../lib/vireglass/adaptation';
import type { VireGlassDebugMode, VireGlassOptics } from '../../lib/vireglass/material';
import { LENS_SHADER } from '../../lib/vireglass/lens-shader';
import { SURFACE_SHADER } from '../../lib/vireglass/surface-shader';
import { useBackdropEnabled } from '../../lib/design/preferences';
import { useGlassSurfaceRegistration } from '../../lib/design/surface-registry';

function compile(src: string) {
  const effect = Skia.RuntimeEffect.Make(src);
  if (!effect) throw new Error('VireGlass: SKSL поверхности не скомпилировался');
  return effect;
}

/** Насколько уменьшается капля, уходя за пальцем: у самого пальца она вдвое меньше тела.
 *  Ноль дал бы вторую такую же деталь вместо капли. */
const LOBE_SHRINK = 0.48;
/** Ширина шейки: доля половины тела, уходящая в сглаживание сшивки. Больше — толще перемычка. */
const LOBE_NECK = 0.38;

const SURFACE = compile(SURFACE_SHADER);

/** Линза принимает тягу анимированным пропом: и она, и поверхность обязаны гнуться в ОДНОМ
 *  кадре. Через обычный проп значение шло бы с JS-потока, а поверхность — с UI, и слои
 *  разъезжались бы ровно так, как это уже было с трансформом. Обёртка создаётся один раз:
 *  createAnimatedComponent в рендере пересоздаёт тип и роняет вьюху каждый кадр. */
const AnimatedGlassLens = GlassLensNative
  ? Animated.createAnimatedComponent(GlassLensNative)
  : null;

export type GlassDynamics = {
  shiftX: SharedValue<number>;
  shiftY: SharedValue<number>;
  press: SharedValue<number>;
  active: SharedValue<number>;
  /** Направление ключевого света в экранных координатах (единичный вектор). */
  light: SharedValue<readonly number[]>;
};

export type GlassIcon = {
  image: SkImage | null;
  /** Масштаб маски: она строится в пикселях устройства, в dp мылит на 3x-экранах. */
  scale: number;
  inkIdle: number[];
  inkActive: number[];
};

export function VireGlassSurface({
  geometry,
  optics,
  dynamics,
  debug = 'normal',
  morph,
  blurTarget,
  backdrop = true,
  shadow = 1,
  dragLimit = 0,
  icon,
  dim = 0,
  onBackdropSample,
  style,
}: {
  geometry: VireGlassGeometry;
  optics: VireGlassOptics;
  dynamics: GlassDynamics;
  debug?: VireGlassDebugMode;
  morph?: VireGlassMorph;
  /** Цель живого блюра — контент текущего экрана (lib/blur-target.tsx). */
  blurTarget?: RefObject<View | null> | null;
  /** Выключение монтирует поверхность без бэкдропа: опорная точка для сравнения на стенде. */
  backdrop?: boolean;
  shadow?: number;
  dragLimit?: number;
  icon?: GlassIcon;
  /** Светлота фона ПОД стеклом, раз в ~200 мс. Отсюда экран узнаёт, что стекло дошло до
   *  своего предела и надпись пора перекрасить (lib/vireglass/adaptation.ts). */
  onBackdropSample?: (e: { nativeEvent: BackdropSample }) => void;
  /** Затемнение линзы под скрим экрана: BlurView целится в контент напрямую и затемняющей
   *  подложки над ним не видит — без этого линза светится дыркой в скриме. */
  dim?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { width, height, cornerRadius } = geometry;
  const pad = surfacePadDp(geometry, dragLimit, morph);

  // Вьюха линзы не должна менять размер на ходу: каждая смена — перераскладка плюс новый
  // `RenderEffect`, и на глаз это читается рывком. Морфинг же двигает вторую форму каждый
  // кадр, то есть меняет нужный запас непрерывно. Поэтому запас только РАСТЁТ: за первый
  // проход он доходит до максимума, дальше размер стоит намертво. Сбрасывается лишь на
  // смене габарита самой детали.
  const padRef = useRef(0);
  const geometryKey = `${width}x${height}x${cornerRadius}`;
  const geometryRef = useRef(geometryKey);
  if (geometryRef.current !== geometryKey) {
    geometryRef.current = geometryKey;
    padRef.current = 0;
  }
  padRef.current = Math.max(padRef.current, lensPadDp(geometry, optics, morph, dragLimit));
  const lensPad = padRef.current;

  // Цель блюра — ref, и на первом рендере она ещё пуста: сама по себе перерисовку она не
  // вызывает. Без этого эффекта стекло остаётся без бэкдропа до первого постороннего
  // ре-рендера — на статичном экране навсегда.
  const [hasTarget, setHasTarget] = useState(false);
  // Нативной линзе нужен ТЕГ цели: по нему она находит внутри неё свой захват.
  const [backdropId, setBackdropId] = useState<number | null>(null);
  useEffect(() => {
    const node = blurTarget?.current ?? null;
    setHasTarget(node != null);
    setBackdropId(node ? findNodeHandle(node) : null);
  }, [blurTarget]);

  // Тело стекла рисует линза, когда она живая: только там виден фон, а без фона точечной
  // адаптации не существует. Поверхности в этом случае остаётся блик, тень и иконка.
  const bodyInLens = isGlassLensSupported && GlassLensNative !== null && hasTarget;
  const statics = useMemo(
    () => toSurfaceUniforms(optics, geometry, { debug, morph, dragLimit, shadow, bodyInLens }),
    [optics, geometry, debug, morph, dragLimit, shadow, bodyInLens],
  );
  // Исходник шейдера — часть результата, поэтому он в зависимостях. Формально это
  // константа модуля, но при горячей перезагрузке она меняется, а мемо с прежними
  // зависимостями продолжает отдавать СТАРЫЙ шейдер: правка оптики молча не доезжает.
  const lensProps = useMemo(
    () => toLensProps(optics, geometry, { debug, morph }),
    [optics, geometry, debug, morph, LENS_SHADER],
  );
  const iconUniforms = useMemo(
    () => ({
      u_iconOn: icon?.image ? 1 : 0,
      u_iconScale: icon?.scale ?? 1,
      u_inkIdle: icon?.inkIdle ?? [1, 1, 1, 1],
      u_inkActive: icon?.inkActive ?? [1, 1, 1, 1],
    }),
    [icon],
  );

  const { shiftX, shiftY, press, active, light } = dynamics;

  // ПЕРЕМЕЩЕНИЕ — общее для обеих половин стекла. Раньше линзу двигал трансформ вьюхи, а
  // поверхность — сдвиг внутри шейдера, то есть две разные системы на одно движение: Skia
  // рисует на своей поверхности и в кадровый бюджет приложения даже не попадает, поэтому на
  // протяжке кромка и преломление расходились. Теперь их несёт ОДИН трансформ, и при
  // перетаскивании перерисовывать нечего вовсе — только двигать.
  // ОДИН трансформ на оба слоя: и перенос, и упругая деформация, и вздутие от нажатия.
  //
  // Деформация раньше жила в двух механизмах сразу — линзу гнул трансформ (нативная вьюха,
  // шейдер её не достаёт), поверхность гнула сама себя в SKSL. Закон был один и тот же, а
  // конвейера два: Reanimated коммитит трансформ в своём кадре, Skia рисует на своей
  // поверхности. Достаточно одного кадра расхождения, чтобы на протяжке кромка отъехала от
  // преломления и слои стало видно по отдельности. Геометрия деформации теперь только здесь,
  // в шейдере от неё остались u_press на блик и на подъём альфы.
  // Тело НЕ ездит за пальцем: тянут не деталь, а её кусок. В трансформе осталось только
  // вздутие от нажатия — оно изотропно и деталь ни повернуть, ни сплющить не может.
  const moveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + press.value * 0.05 }],
  }));

  const halfMin = Math.min(geometry.width, geometry.height) / 2;
  // Канал линзы в пикселях, а вся геометрия модели — в dp. Читается один раз: PixelRatio
  // в ворклете недоступен.
  const density = PixelRatio.get();

  /**
   * Тяга — ВТОРАЯ форма, сшитая с телом, а не деформация тела. Тело стоит на месте, за
   * пальцем уходит капля поменьше, между ними smin даёт шейку. Симметричное растяжение,
   * которое стояло здесь раньше, вытягивало деталь и в противоположную сторону — с
   * прилипшей каплей такого не бывает, и деталь читалась пилюлей, а не материалом.
   *
   * Отдаётся плоским набором в том же порядке, в каком морфинг лежит в канале униформ:
   * offsetX, offsetY, halfW, halfH, corner, neck.
   */
  const lobe = useDerivedValue(() => {
    const dx = shiftX.value;
    const dy = shiftY.value;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (dragLimit <= 0 || len < 0.01) return [0, 0, 0, 0, 0, 0];
    const k = Math.min(len / dragLimit, 1);
    const r = halfMin * (1 - LOBE_SHRINK * k);
    return [dx, dy, r, r, r, halfMin * LOBE_NECK * k];
  }, [dragLimit, halfMin]);

  // Место морфинга в плоском канале униформ линзы. Имена и размеры фиксированы, шесть
  // величин лежат подряд — смещение считается один раз, в ворклете остаётся подставить.
  const lobeSlot = useMemo(() => {
    let at = 0;
    for (let i = 0; i < lensProps.uniformNames.length; i += 1) {
      if (lensProps.uniformNames[i] === 'u_morphOffset') return at;
      at += lensProps.uniformSizes[i];
    }
    return -1;
  }, [lensProps]);

  const lensAnimatedProps = useAnimatedProps<{ uniformValues: number[] }>(() => {
    const values = lensProps.uniformValues.slice();
    if (lobeSlot >= 0 && lobe.value[5] > 0) {
      // Канал линзы в пикселях: капля считается в dp, как и вся геометрия.
      for (let i = 0; i < 6; i += 1) values[lobeSlot + i] = lobe.value[i] * density;
    }
    return { uniformValues: values };
  }, [lensProps, lobeSlot, density]);

  const uniforms = useDerivedValue(() => {
    return {
      ...statics,
      ...iconUniforms,
      // Капля перебивает статический морфинг: тянуть и одновременно сшивать две
      // поверхности стенд не просит, а тяга обязана быть живой.
      u_morphOffset: lobe.value[5] > 0 ? [lobe.value[0], lobe.value[1]] : statics.u_morphOffset,
      u_morphHalf: lobe.value[5] > 0 ? [lobe.value[2], lobe.value[3]] : statics.u_morphHalf,
      u_morphCorner: lobe.value[5] > 0 ? lobe.value[4] : statics.u_morphCorner,
      u_morphK: lobe.value[5] > 0 ? lobe.value[5] : statics.u_morphK,
      u_press: press.value,
      u_active: active.value,
      u_light: [light.value[0], light.value[1]],
    };
  }, [statics, iconUniforms, lobe]);

  const refracting = isGlassLensSupported && GlassLensNative !== null;
  const magnify = lensMagnify(optics);

  // Единственная точка, где решается, живёт ли бэкдроп. Через неё проходит ВСЁ стекло
  // приложения, поэтому и тумблер настроек, и подавление под открытым листом стоят здесь,
  // а не размазаны по потребителям. Подавление под листом предписывает сам кит: нижние
  // слои за скримом преломлять нечего, и оно же удерживает бюджет поверхностей в зелёной
  // зоне (`lib/design/glass-budget.ts`).
  const backdropAllowed = useBackdropEnabled();
  const liveBackdrop = backdrop && backdropAllowed;

  // Сторожит ФАКТИЧЕСКОЕ число живых поверхностей; тест стережёт объявленную модель.
  useGlassSurfaceRegistration(liveBackdrop && hasTarget);

  return (
    <View collapsable={false} style={[styles.host, style, { width, height }]}>
      {/* Состояние «reduced» из кита: стекло выключено — панель непрозрачна, blur снят. */}
      {!backdropAllowed && (
        <View
          style={[styles.opaque, { width, height, borderRadius: cornerRadius }]}
          pointerEvents="none"
        />
      )}
      {/* Снимок экрана (makeImageFromView) для бэкдропа не годится в принципе: ~1000 мс на
          кадр, любое преломление по нему отстаёт. BlurView с blurTarget рисует контент
          экрана покадрово нативно и выровнен с ним по построению. */}
      {/* collapsable={false} обязателен обоим: в статичном стиле трансформа нет, он приезжает
          только из ворклета, и Android-RN считает такой узел лишним и схлопывает его в
          родителя — деформация тогда просто некуда применяться. */}
      <Animated.View
        style={[styles.moving, { width, height }, moveStyle]}
        pointerEvents="none"
        collapsable={false}
      >
        <View style={[styles.lens, { width, height }]}>
        {liveBackdrop && hasTarget && blurTarget?.current ? (
          refracting && AnimatedGlassLens ? (
            // Вьюха линзы НАМЕРЕННО больше стекла — у кромки выборка уходит за его пределы,
            // форму вырезает сам шейдер.
            <AnimatedGlassLens
              {...lensProps}
              animatedProps={lensAnimatedProps}
              backdropId={backdropId}
              onBackdropSample={onBackdropSample}
              style={{
                position: 'absolute',
                width: width + lensPad * 2,
                height: height + lensPad * 2,
              }}
            />
          ) : (
            // Фолбэк ниже Android 13: равномерное увеличение. Это лупа, а не линза —
            // радиально переменного смещения аффинным трансформом не выразить.
            <View style={[styles.clip, { width, height, borderRadius: cornerRadius }]}>
              <View
                style={{
                  position: 'absolute',
                  left: (width * (1 - 1 / magnify)) / 2,
                  top: (height * (1 - 1 / magnify)) / 2,
                  width: width / magnify,
                  height: height / magnify,
                  transform: [{ scale: magnify }],
                }}
              >
                {/* Фолбэк шейдера не имеет — размывать, кроме BlurView, тут нечем. */}
                <BlurView
                  intensity={optics.blur}
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
            style={[styles.scrim, { width, height, borderRadius: cornerRadius, opacity: dim }]}
          />
        ) : null}
        </View>
        <Canvas
        style={[
          styles.canvas,
          { width: width + pad * 2, height: height + pad * 2, left: -pad, top: -pad },
        ]}
      >
        {/* dither ВЫКЛЮЧЕН: Skia подмешивает его при растеризации в 8-битную поверхность,
            и на тёмном это читается крупой. Замерено в стенде: с выключенным бэкдропом,
            когда остаётся только этот слой, зерно внутри 3.5 против 0.04 снаружи. */}
        <Fill dither={false}>
          <Shader source={SURFACE} uniforms={uniforms}>
            {icon?.image ? (
              <ImageShader image={icon.image} tx="decal" ty="decal" />
            ) : (
              <ColorShader color="#00000000" />
            )}
          </Shader>
        </Fill>
        </Canvas>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { overflow: 'visible' },
  moving: { position: 'absolute' },
  lens: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  clip: { position: 'absolute', overflow: 'hidden' },
  canvas: { position: 'absolute' },
  scrim: { position: 'absolute', backgroundColor: '#0d0b09' },
  // Непрозрачная подложка режима «стекло выключено» — цвет из кита (§02, состояние reduced).
  opaque: { position: 'absolute', backgroundColor: '#0b0908' },
});

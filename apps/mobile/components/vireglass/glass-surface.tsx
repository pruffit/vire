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
import type { DeformSample } from '../../lib/vireglass/touch-response';
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

/** Доля активности, которую поднимает само касание (веб — `main.ts`, buttonPieces). */
const ACTIVE_ON_TOUCH = 0.3;

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
  /** Цветной слой НА стекле: обложка играющего трека. Маска одноканальная и красится
   *  полярностью, а этот слой несёт свой цвет как есть (веб — `rnd-src/mini-player.ts`).
   *  Коробка у него та же, что у маски: шейдер семплирует оба по одному `inkUv`. */
  overlay?: SkImage | null;
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
  progress,
  touch,
  dim = 0,
  topLayer = false,
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
  /** Сыгранная доля, 0…1: слева от границы деталь активна, справа нет. Едет shared value —
   *  обычным пропом она пересобирала бы весь канал униформ и затирала подставленную
   *  ворклетом каплю тяги, ровно как это уже было со статическим uniformValues. */
  progress?: SharedValue<number>;
  /** Отклик на палец ПО МОДЕЛИ ЯДРА (`createDeform`): точка касания, тяга вокруг пятна,
   *  вдавливание и волна. Здесь этого не было вовсе — в шейдер уходил `NO_TOUCH`, то есть
   *  нули, и деформации не существовало ни при каком жесте. Веб гоняет ровно эти же поля
   *  (`web/renderer.ts`), контракт адаптеров общий и задан в dp. */
  touch?: SharedValue<DeformSample>;
  /** Светлота фона ПОД стеклом, раз в ~200 мс. Отсюда экран узнаёт, что стекло дошло до
   *  своего предела и надпись пора перекрасить (lib/vireglass/adaptation.ts). */
  onBackdropSample?: (e: { nativeEvent: BackdropSample }) => void;
  /** Затемнение линзы под скрим экрана: BlurView целится в контент напрямую и затемняющей
   *  подложки над ним не видит — без этого линза светится дыркой в скриме. */
  dim?: number;
  /** Поверхность верхнего слоя: не глушится собственным экраном-оверлеем. */
  topLayer?: boolean;
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
    // Оценка фона — СОБСТВЕННЫЙ зонд линзы, как в вебе. Групповая оценка перебивала его
    // и была изобретением андроидного пути: в вебе `groupProbe` нет вовсе, там каждая
    // деталь адаптируется по своему зонду. Из-за перебивки навигация и «Поток»
    // адаптировались к окружению по-разному при одном материале.
    () => toLensProps(optics, geometry, PixelRatio.get(), { debug, morph }),
    [optics, geometry, debug, morph, LENS_SHADER],
  );
  const iconUniforms = useMemo(
    () => ({
      u_iconOn: icon?.image ? 1 : 0,
      u_iconScale: icon?.scale ?? 1,
      // Слот в шейдере обязан быть занят всегда: Skia раздаёт дочерние шейдеры по порядку
      // объявления, и пустой слот сдвинул бы маску краски.
      u_overlayOn: icon?.overlay ? 1 : 0,
      u_inkIdle: icon?.inkIdle ?? [1, 1, 1, 1],
      u_inkActive: icon?.inkActive ?? [1, 1, 1, 1],
    }),
    [icon],
  );

  const { press, active, light } = dynamics;

  const halfMin = Math.min(geometry.width, geometry.height) / 2;
  /** Палец — площадь, а не остриё. Радиус берётся от МЕНЬШЕГО полуразмера: иначе на широкой
   *  плашке касание расползлось бы на всю её длину. Доля та же, что в вебе (`main.ts`). */
  const touchRadius = 0.72 * halfMin;
  // Канал линзы в пикселях, а вся геометрия модели — в dp. Читается один раз: PixelRatio
  // в ворклете недоступен.
  const density = PixelRatio.get();

  // Места величин в плоском канале униформ линзы. Имена и размеры фиксированы, поэтому
  // смещения считаются один раз, а в ворклете остаётся подставить числа.
  const slots = useMemo(() => {
    const at: Record<string, number> = {};
    let i = 0;
    for (let k = 0; k < lensProps.uniformNames.length; k += 1) {
      at[lensProps.uniformNames[k]] = i;
      i += lensProps.uniformSizes[k];
    }
    return {
      progress: at.u_progress ?? -1,
      touch: at.u_touch ?? -1,
      pull: at.u_pull ?? -1,
      touchPress: at.u_touchPress ?? -1,
      touchRadius: at.u_touchRadius ?? -1,
      wave: at.u_wave ?? -1,
      light: at.u_light ?? -1,
    };
  }, [lensProps]);

  // Значения униформ уезжают ТОЛЬКО анимированным пропом. Пока они шли ещё и обычным, с
  // активной группой (та перерисовывает блок два десятка раз в секунду) обычный проп
  // затирал подставленную ворклетом каплю, и на кадре её просто не было.
  const { uniformValues: _values, ...lensStatic } = lensProps;

  const lensAnimatedProps = useAnimatedProps<{ uniformValues: number[] }>(() => {
    const values = lensProps.uniformValues.slice();
    if (slots.progress >= 0 && progress) values[slots.progress] = progress.value;
    // Кромочный свет считает линза, а наклон устройства приходит ворклетом — сюда же.
    if (slots.light >= 0) {
      values[slots.light] = light.value[0];
      values[slots.light + 1] = light.value[1];
    }
    // Отклик на палец. Канал линзы в ПИКСЕЛЯХ, а модель — в dp: геометрические поля
    // домножаются на плотность, фаза волны и вдавливание безразмерны. Тот же пересчёт
    // делает веб (`web/renderer.ts`), контракт адаптера трогать нельзя — он общий.
    if (touch) {
      const t = touch.value;
      if (slots.touch >= 0) {
        values[slots.touch] = t.touchX * density;
        values[slots.touch + 1] = t.touchY * density;
      }
      if (slots.pull >= 0) {
        values[slots.pull] = t.pullX * density;
        values[slots.pull + 1] = t.pullY * density;
      }
      if (slots.touchPress >= 0) values[slots.touchPress] = t.press;
      if (slots.touchRadius >= 0) values[slots.touchRadius] = touchRadius * density;
      if (slots.wave >= 0) {
        values[slots.wave] = t.waveAmp * density;
        values[slots.wave + 1] = t.wavePhase;
      }
    }
    return { uniformValues: values };
  }, [lensProps, slots, density, progress, touch, touchRadius, light]);

  const uniforms = useDerivedValue(() => {
    return {
      ...statics,
      ...iconUniforms,
      // Отклик на палец по модели ядра. Раньше сюда не приезжало ничего, и шейдер работал
      // на `NO_TOUCH` — нулях: ни точки касания, ни тяги, ни волны не существовало.
      u_touch: touch ? [touch.value.touchX, touch.value.touchY] : statics.u_touch,
      u_pull: touch ? [touch.value.pullX, touch.value.pullY] : statics.u_pull,
      u_touchPress: touch ? touch.value.press : statics.u_touchPress,
      u_touchRadius: touch ? touchRadius : statics.u_touchRadius,
      u_wave: touch ? [touch.value.waveAmp, touch.value.wavePhase] : statics.u_wave,
      u_press: touch ? touch.value.press : press.value,
      // Касание и активность идут в одну униформу: берётся сильнейшее, иначе нажатие на уже
      // активную деталь читалось бы как её выключение. Доля та же, что в вебе (`main.ts`,
      // buttonPieces): касание поднимает активность на треть, а не до полной.
      u_active: touch ? Math.max(touch.value.active * ACTIVE_ON_TOUCH, active.value) : active.value,
      u_light: [light.value[0], light.value[1]],
      u_progress: progress ? progress.value : statics.u_progress,
    };
  }, [statics, iconUniforms, progress, touch, touchRadius]);

  const refracting = isGlassLensSupported && GlassLensNative !== null;
  const magnify = lensMagnify(optics);

  // Единственная точка, где решается, живёт ли бэкдроп. Через неё проходит ВСЁ стекло
  // приложения, поэтому и тумблер настроек, и подавление под открытым листом стоят здесь,
  // а не размазаны по потребителям. Подавление под листом предписывает сам кит: нижние
  // слои за скримом преломлять нечего, и оно же удерживает бюджет поверхностей в зелёной
  // зоне (`lib/design/glass-budget.ts`).
  const backdropAllowed = useBackdropEnabled(topLayer);
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
      <View
        style={[styles.moving, { width, height }]}
        pointerEvents="none"
        collapsable={false}
      >
        <View style={[styles.lens, { width, height }]}>
        {liveBackdrop && hasTarget && blurTarget?.current ? (
          refracting && AnimatedGlassLens ? (
            // Вьюха линзы НАМЕРЕННО больше стекла — у кромки выборка уходит за его пределы,
            // форму вырезает сам шейдер.
            <AnimatedGlassLens
              {...lensStatic}
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
            {/* Второй слот — цветной слой (u_overlay): обложка мини-плеера. */}
            {icon?.overlay ? (
              <ImageShader image={icon.overlay} tx="decal" ty="decal" />
            ) : (
              <ColorShader color="#00000000" />
            )}
          </Shader>
        </Fill>
        </Canvas>
      </View>
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

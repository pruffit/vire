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
const LOBE_SHRINK = 0.24;
/** Ширина шейки: доля половины тела, уходящая в сглаживание сшивки. Больше — толще перемычка. */
const LOBE_NECK = 0.30;
/** Насколько худеет донор на полном вылете капли. Ноль означал бы, что стекло берётся
 *  из ниоткуда: деталь читалась бы кнопкой с приклеенным пузырём, а не материалом. */
const DONOR_LOSS = 0.2;

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
  topLayer = false,
  onBackdropSample,
  groupProbe,
  pullBus,
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
  /** Оценка фона на всю группу поверхностей. Пусто — линза считает по своему замеру. */
  groupProbe?: number[];
  /** Общая шина тяги группы и место этой детали в ней. Своя капля рисуется от нуля, чужая —
   *  от места детали на экране, и на подходе две поверхности сливаются в одну. */
  pullBus?: { bus: SharedValue<number[]>; seat: number; centerX: number; centerY: number };
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
    () => toLensProps(optics, geometry, PixelRatio.get(), { debug, morph, groupProbe }),
    [optics, geometry, debug, morph, groupProbe, LENS_SHADER],
  );
  const iconUniforms = useMemo(
    () => ({
      u_iconOn: icon?.image ? 1 : 0,
      u_iconScale: icon?.scale ?? 1,
      // Цветного слоя на стекле у мобильного плеера пока нет: обложка и миниатюры рисуются
      // детьми вьюхи. Слот в шейдере при этом обязан быть занят — Skia раздаёт дочерние
      // шейдеры по порядку объявления, и пустой слот сдвинул бы маску краски.
      u_overlayOn: 0,
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
    const mine = dragLimit > 0 && len >= 0.01;
    if (mine) {
      const k = Math.min(len / dragLimit, 1);
      const r = halfMin * (1 - LOBE_SHRINK * k);
      const neck = halfMin * LOBE_NECK * k;
      // Капля объявляется всей группе: соседи подхватят её и на подходе сольются.
      if (pullBus) {
        pullBus.bus.value = [pullBus.centerX + dx, pullBus.centerY + dy, r, neck, pullBus.seat];
      }
      // Донор теряет материал: он остаётся на месте, но худеет — иначе стекло берётся
      // из ниоткуда, и деталь читается не материалом, а кнопкой с приклеенным пузырём.
      return [dx, dy, r, r, r, neck, 1 - DONOR_LOSS * k, Math.min(1, r / halfMin)];
    }
    if (pullBus && pullBus.bus.value[4] === pullBus.seat) {
      pullBus.bus.value = [0, 0, 0, 0, -1];
    }
    // Чужая капля: та же вторая форма, только её место считается от центра ЭТОЙ детали.
    //
    // Условие ЖЁСТКОЕ — капля должна лезть в само тело соседа, а не просто оказаться
    // поблизости. Иначе сосед рисует её у себя ТАМ, ГДЕ У НЕГО НЕТ ЛИНЗЫ: преломлению
    // взяться неоткуда, выходит непрозрачное пятно, и вдобавок холст соседа лежит выше
    // холста донора — пятно перекрывает донору иконку. На кадре это выглядит абсурдом,
    // и это он и есть.
    //
    // При нынешнем шаге таб-бара (90 dp) и ходе тяги (42 dp) условие не выполняется
    // никогда: дотянуться до соседа кнопка просто не может. Слияние включится там, где
    // поверхности стоят ближе.
    if (pullBus && pullBus.bus.value[3] > 0 && pullBus.bus.value[4] !== pullBus.seat) {
      const bx = pullBus.bus.value[0] - pullBus.centerX;
      const by = pullBus.bus.value[1] - pullBus.centerY;
      const r = pullBus.bus.value[2];
      const reach = halfMin + r * 0.25;
      if (bx * bx + by * by < reach * reach) {
        return [bx, by, r, r, r, pullBus.bus.value[3], 1, Math.min(1, r / halfMin)];
      }
    }
    return [0, 0, 0, 0, 0, 0, 1, 1];
  }, [dragLimit, halfMin, pullBus]);

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
      lobe: at.u_morphOffset ?? -1,
      half: at.u_halfSize ?? -1,
      corner: at.u_corner ?? -1,
      bevel: at.u_bevel ?? -1,
    };
  }, [lensProps]);

  // Значения униформ уезжают ТОЛЬКО анимированным пропом. Пока они шли ещё и обычным, с
  // активной группой (та перерисовывает блок два десятка раз в секунду) обычный проп
  // затирал подставленную ворклетом каплю, и на кадре её просто не было.
  const { uniformValues: _values, ...lensStatic } = lensProps;

  const lensAnimatedProps = useAnimatedProps<{ uniformValues: number[] }>(() => {
    const values = lensProps.uniformValues.slice();
    if (slots.lobe >= 0 && lobe.value[5] > 0) {
      // Канал линзы в пикселях: капля считается в dp, как и вся геометрия.
      for (let i = 0; i < 6; i += 1) values[slots.lobe + i] = lobe.value[i] * density;
    }
    const loss = lobe.value[6];
    if (loss < 1 && slots.half >= 0) {
      values[slots.half] = lensProps.uniformValues[slots.half] * loss;
      values[slots.half + 1] = lensProps.uniformValues[slots.half + 1] * loss;
      if (slots.corner >= 0) values[slots.corner] = lensProps.uniformValues[slots.corner] * loss;
    }
    if (lobe.value[7] < 1 && slots.bevel >= 0) {
      values[slots.bevel] = lensProps.uniformValues[slots.bevel] * lobe.value[7];
    }
    return { uniformValues: values };
  }, [lensProps, slots, density]);

  const uniforms = useDerivedValue(() => {
    return {
      ...statics,
      ...iconUniforms,
      // Капля перебивает статический морфинг: тянуть и одновременно сшивать две
      // поверхности стенд не просит, а тяга обязана быть живой.
      // Донор худеет: тело уменьшается ровно на ту долю, что ушла в каплю.
      u_halfSize: [statics.u_halfSize[0] * lobe.value[6], statics.u_halfSize[1] * lobe.value[6]],
      u_corner: statics.u_corner * lobe.value[6],
      // Фаска задана в абсолютных dp под размер тела. Капля вдвое меньше — с прежней
      // фаской она становится фаской ЦЕЛИКОМ, поглощение насыщается, и вместо стекла
      // получается чёрная дыра с резким ободком.
      u_bevel: statics.u_bevel * lobe.value[7],
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
            {/* Второй слот — цветной слой (u_overlay). Пустой, пока его сюда не подключат. */}
            <ColorShader color="#00000000" />
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

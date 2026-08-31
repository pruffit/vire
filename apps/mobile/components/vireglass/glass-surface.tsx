import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  findNodeHandle,
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
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { GlassLens as GlassLensNative, isGlassLensSupported } from '../../modules/glass-lens';
import { toLensProps, toSurfaceUniforms, type VireGlassMorph } from '../../lib/vireglass/adapters';
import {
  lensPadDp,
  MAX_STRETCH,
  surfacePadDp,
  type VireGlassGeometry,
} from '../../lib/vireglass/geometry';
import type { VireGlassDebugMode, VireGlassOptics } from '../../lib/vireglass/material';
import { SURFACE_SHADER } from '../../lib/vireglass/surface-shader';
import { useBackdropEnabled } from '../../lib/design/preferences';
import { useGlassSurfaceRegistration } from '../../lib/design/surface-registry';

function compile(src: string) {
  const effect = Skia.RuntimeEffect.Make(src);
  if (!effect) throw new Error('VireGlass: SKSL поверхности не скомпилировался');
  return effect;
}

const SURFACE = compile(SURFACE_SHADER);

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
  const lensProps = useMemo(
    () => toLensProps(optics, geometry, { debug, morph }),
    [optics, geometry, debug, morph],
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

  // Ворклет исполняется на UI-потоке и втягивает в замыкание только то, что babel-плагин
  // сумел захватить: импорт из ДРУГОГО модуля он не тянет, и на устройстве это падает
  // `ReferenceError: Property 'MAX_STRETCH' doesn't exist`. Typecheck и тесты такое не
  // видят — ворклеты они не исполняют. Локальная переменная компонента захватывается всегда.
  const stretchLimit = MAX_STRETCH;

  // ПЕРЕМЕЩЕНИЕ — общее для обеих половин стекла. Раньше линзу двигал трансформ вьюхи, а
  // поверхность — сдвиг внутри шейдера, то есть две разные системы на одно движение: Skia
  // рисует на своей поверхности и в кадровый бюджет приложения даже не попадает, поэтому на
  // протяжке кромка и преломление расходились. Теперь их несёт ОДИН трансформ, и при
  // перетаскивании перерисовывать нечего вовсе — только двигать.
  const moveStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shiftX.value }, { translateY: shiftY.value }],
  }));

  // Живая подложка обязана повторять деформацию стекла: она нативная вьюха, шейдер её не
  // гнёт, поэтому тот же закон применяется трансформом. Здесь остаётся только деформация —
  // перенос уехал уровнем выше.
  const lensStyle = useAnimatedStyle(() => {
    const dx = shiftX.value;
    const dy = shiftY.value;
    const len = Math.sqrt(dx * dx + dy * dy);
    const stretch = dragLimit > 0 ? Math.min(len / dragLimit, 1) * stretchLimit : 0;
    const along = 1 + stretch;
    const angle = len > 0.001 ? Math.atan2(dy, dx) : 0;
    const bulge = 1 + press.value * 0.05;
    return {
      transform: [
        { rotate: `${angle}rad` },
        { scaleX: along * bulge },
        { scaleY: (1 / Math.sqrt(along)) * bulge },
        { rotate: `${-angle}rad` },
      ],
    };
  });

  const uniforms = useDerivedValue(() => {
    const dx = shiftX.value;
    const dy = shiftY.value;
    const len = Math.sqrt(dx * dx + dy * dy);
    const inv = len > 0.001 ? 1 / len : 0;
    return {
      ...statics,
      ...iconUniforms,
      // Перенос делает трансформ обёртки, шейдеру он больше не нужен — иначе сдвиг
      // применился бы дважды. Направление тяги остаётся: по нему идёт деформация.
      u_shift: [0, 0],
      u_dir: [dx * inv, dy * inv],
      u_stretch: dragLimit > 0 ? Math.min(len / dragLimit, 1) * stretchLimit : 0,
      u_press: press.value,
      u_active: active.value,
      u_light: [light.value[0], light.value[1]],
    };
  }, [statics, iconUniforms, dragLimit]);

  const refracting = isGlassLensSupported && GlassLensNative !== null;

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
      <Animated.View style={[styles.moving, { width, height }, moveStyle]} pointerEvents="none">
        <Animated.View style={[styles.lens, { width, height }, lensStyle]}>
        {liveBackdrop && hasTarget && blurTarget?.current ? (
          refracting && GlassLensNative ? (
            // Вьюха линзы НАМЕРЕННО больше стекла — у кромки выборка уходит за его пределы,
            // форму вырезает сам шейдер.
            <GlassLensNative
              {...lensProps}
              backdropId={backdropId}
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
                  left: (width * (1 - 1 / lensProps.magnify)) / 2,
                  top: (height * (1 - 1 / lensProps.magnify)) / 2,
                  width: width / lensProps.magnify,
                  height: height / lensProps.magnify,
                  transform: [{ scale: lensProps.magnify }],
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
        </Animated.View>
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

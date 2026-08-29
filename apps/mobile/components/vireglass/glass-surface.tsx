import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
import { lensPadDp, surfacePadDp, type VireGlassGeometry } from '../../lib/vireglass/geometry';
import type { VireGlassDebugMode, VireGlassMaterial } from '../../lib/vireglass/material';
import { SURFACE_SHADER } from '../../lib/vireglass/surface-shader';

function compile(src: string) {
  const effect = Skia.RuntimeEffect.Make(src);
  if (!effect) throw new Error('VireGlass: SKSL поверхности не скомпилировался');
  return effect;
}

const SURFACE = compile(SURFACE_SHADER);

/** Максимальное растяжение вдоль вектора тяги. Один и тот же закон применяют шейдер
 *  (обратной деформацией координаты) и трансформ живой подложки — иначе они разъезжаются. */
export const MAX_STRETCH = 0.17;

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
  material,
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
  material: VireGlassMaterial;
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
  const lensPad = lensPadDp(geometry, material, morph);

  const statics = useMemo(
    () => toSurfaceUniforms(material, geometry, { debug, morph, dragLimit, shadow }),
    [material, geometry, debug, morph, dragLimit, shadow],
  );
  const lensProps = useMemo(
    () => toLensProps(material, geometry, { debug, morph }),
    [material, geometry, debug, morph],
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

  // Цель блюра — ref, и на первом рендере она ещё пуста: сама по себе перерисовку она не
  // вызывает. Без этого эффекта стекло остаётся без бэкдропа до первого постороннего
  // ре-рендера — на статичном экране навсегда.
  const [hasTarget, setHasTarget] = useState(false);
  useEffect(() => {
    setHasTarget(blurTarget?.current != null);
  }, [blurTarget]);

  // Живая подложка обязана повторять деформацию стекла: она нативная вьюха, шейдер её не
  // гнёт, поэтому тот же закон применяется трансформом.
  const lensStyle = useAnimatedStyle(() => {
    const dx = shiftX.value;
    const dy = shiftY.value;
    const len = Math.sqrt(dx * dx + dy * dy);
    const stretch = dragLimit > 0 ? Math.min(len / dragLimit, 1) * MAX_STRETCH : 0;
    const along = 1 + stretch;
    const angle = len > 0.001 ? Math.atan2(dy, dx) : 0;
    const bulge = 1 + press.value * 0.05;
    return {
      transform: [
        { translateX: dx },
        { translateY: dy },
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
      u_shift: [dx, dy],
      u_dir: [dx * inv, dy * inv],
      u_stretch: dragLimit > 0 ? Math.min(len / dragLimit, 1) * MAX_STRETCH : 0,
      u_press: press.value,
      u_active: active.value,
      u_light: [light.value[0], light.value[1]],
    };
  }, [statics, iconUniforms, dragLimit]);

  const refracting = isGlassLensSupported && GlassLensNative !== null;

  return (
    <View collapsable={false} style={[styles.host, style, { width, height }]}>
      {/* Снимок экрана (makeImageFromView) для бэкдропа не годится в принципе: ~1000 мс на
          кадр, любое преломление по нему отстаёт. BlurView с blurTarget рисует контент
          экрана покадрово нативно и выровнен с ним по построению. */}
      <Animated.View style={[styles.lens, { width, height }, lensStyle]}>
        {backdrop && hasTarget && blurTarget?.current ? (
          refracting && GlassLensNative ? (
            // Вьюха линзы НАМЕРЕННО больше стекла — у кромки выборка уходит за его пределы,
            // форму вырезает сам шейдер.
            <GlassLensNative
              {...lensProps}
              style={{
                position: 'absolute',
                width: width + lensPad * 2,
                height: height + lensPad * 2,
              }}
            >
              <BlurView
                intensity={material.blur}
                tint="dark"
                blurMethod="dimezisBlurView"
                blurTarget={blurTarget}
                style={StyleSheet.absoluteFill}
              />
            </GlassLensNative>
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
                <BlurView
                  intensity={material.blur}
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
        <Fill>
          <Shader source={SURFACE} uniforms={uniforms}>
            {icon?.image ? (
              <ImageShader image={icon.image} tx="decal" ty="decal" />
            ) : (
              <ColorShader color="#00000000" />
            )}
          </Shader>
        </Fill>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { overflow: 'visible' },
  lens: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  clip: { position: 'absolute', overflow: 'hidden' },
  canvas: { position: 'absolute' },
  scrim: { position: 'absolute', backgroundColor: '#0d0b09' },
});

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Rect, RadialGradient, LinearGradient, Stop } from 'react-native-svg';
import { motionDuration } from '../../lib/design/scales';
import { useReduceMotion } from '../../lib/design/preferences';
import type { Accent } from '../../lib/design/accent';

/** Радиус ореола относительно ширины обложки. Обложка НЕПРОЗРАЧНА и закрывает середину
 *  градиента, поэтому радиус считается по тому, докуда свет доходит ЗА её кромкой: на 1.4
 *  он гас уже у названия трека, и сцена читалась ровной заливкой. */
const HALO_RADIUS_RATIO = 2.6;
const HALO_ALPHA = 0.68;
const DIAGONAL_ALPHA = 0.38;
const DIAGONAL_RADIUS_RATIO = 0.9;
/** Диагональ бьёт из левого края ВЫШЕ зоны `deep`: в нижнем углу её съедал бы тот самый
 *  градиент, которым низ экрана гасится. */
const DIAGONAL_Y = 0.55;
/** С этой доли высоты начинается уход в `deep`. */
const DEEP_START = 2 / 3;

/** Один слой сцены: тон поля, свет от обложки, диагональное пятно, уход в `deep` книзу. */
function SceneLayer({
  accent,
  haloCenterX,
  haloCenterY,
  haloRadius,
  width,
  height,
}: {
  accent: Accent;
  haloCenterX: number;
  haloCenterY: number;
  haloRadius: number;
  width: number;
  height: number;
}) {
  const deepTop = height * DEEP_START;
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
      <Defs>
        <RadialGradient id="halo" cx={haloCenterX} cy={haloCenterY} r={haloRadius} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accent.halo} stopOpacity={HALO_ALPHA} />
          <Stop offset="1" stopColor={accent.halo} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient
          id="diagonal"
          cx={0}
          cy={height * DIAGONAL_Y}
          r={Math.max(width, height) * DIAGONAL_RADIUS_RATIO}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={accent.diagonal} stopOpacity={DIAGONAL_ALPHA} />
          <Stop offset="1" stopColor={accent.diagonal} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="deep" x1={0} y1={deepTop} x2={0} y2={height} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accent.deep} stopOpacity={0} />
          <Stop offset="1" stopColor={accent.deep} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={accent.base} />
      <Rect x={0} y={0} width={width} height={height} fill="url(#halo)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#diagonal)" />
      <Rect x={0} y={deepTop} width={width} height={height - deepTop} fill="url(#deep)" />
    </Svg>
  );
}

/**
 * Сцена плеера: свет, который даёт обложка. Разбор —
 * `docs/superpowers/specs/2026-09-03-mobile-player-v4-brief.md` §5.
 *
 * Рисуется SVG, а не Skia: канвас Skia не попадает в снимок RenderNode, из которого стекло
 * берёт преломление, и любая панель над сценой выходила чёрной.
 *
 * Смена трека переливается кросс-фейдом: второй слой живёт только на время перехода.
 */
export function PlayerGround({
  accent,
  width,
  height,
  haloCenterX,
  haloCenterY,
  artSize,
}: {
  accent: Accent;
  width: number;
  height: number;
  /** Центр обложки в системе координат экрана — считает player-screen.tsx по замеренной рамке. */
  haloCenterX: number;
  haloCenterY: number;
  artSize: number;
}) {
  const reduceMotion = useReduceMotion();

  const prevAccentRef = useRef(accent);
  const [layers, setLayers] = useState<{ from: Accent; to: Accent }>({ from: accent, to: accent });
  const fade = useSharedValue(1);

  useEffect(() => {
    if (accent === prevAccentRef.current) return;
    const from = prevAccentRef.current;
    prevAccentRef.current = accent;
    setLayers({ from, to: accent });
    fade.value = 0;
    fade.value = withTiming(1, { duration: motionDuration('ambient', reduceMotion) });
  }, [accent, reduceMotion, fade]);

  const crossfading = layers.from !== layers.to;
  const haloRadius = artSize * HALO_RADIUS_RATIO;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {crossfading && (
        <SceneLayer
          accent={layers.from}
          haloCenterX={haloCenterX}
          haloCenterY={haloCenterY}
          haloRadius={haloRadius}
          width={width}
          height={height}
        />
      )}
      <Animated.View style={[StyleSheet.absoluteFill, crossfading ? { opacity: fade } : null]}>
        <SceneLayer
          accent={layers.to}
          haloCenterX={haloCenterX}
          haloCenterY={haloCenterY}
          haloRadius={haloRadius}
          width={width}
          height={height}
        />
      </Animated.View>
    </View>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Rect, RadialGradient, LinearGradient, Stop } from 'react-native-svg';
import { motionDuration } from '../lib/design/scales';
import { useReduceMotion } from '../lib/design/preferences';
import { hueHex, type Accent } from '../lib/design/accent';

/**
 * Фон приложения: тёмная нейтральная база и два цветных пятна дымки.
 *
 * Это ПОРТ `drawAppBackground` из веба (`apps/web/rnd-src/scenes.ts`) — те же ступени базы,
 * те же центры, радиусы, светлоты и альфы. Из обложки берётся ОДИН ТОН; светлота и
 * насыщенность дымки заданы сценой, а не ролями акцента: роли `halo`/`diagonal` вдвое темнее
 * веба (L 0.32 и 0.22 против 0.55 и 0.45), и на них экран уходил в почти-чёрное — стеклу
 * над таким фоном нечего преломлять.
 *
 * Рисуется SVG, а не Skia: канвас Skia не попадает в снимок RenderNode, из которого стекло
 * берёт преломление, и любая панель над сценой вышла бы чёрной.
 */
const BASE = ['#12151b', '#0c0e13', '#07080b'] as const;
/** Верх базы. Наружу — чтобы закреплённая шапка гасла ровно в тон сцены под собой. */
export const HAZE_TOP = BASE[0];
const BASE_STOPS = [0, 0.55, 1] as const;

/** Второй тон уведён по кругу на 55°: на одном оттенке дымка выглядит светофильтром. */
const BLOB = [
  { x: 0.22, y: 0.18, radius: 0.85, hue: 0, alpha: 0.3 },
  { x: 0.85, y: 0.62, radius: 0.75, hue: 55, alpha: 0.22 },
] as const;
/** Светлоты дымки по радиусу и её насыщенность — величины сцены, общие с вебом. */
const HAZE_S = 0.7;
const HAZE_L = [0.55, 0.45, 0.4] as const;

/**
 * Зерно поверх дымки. Радиальный градиент растягивает 1/255-ступень альфы на несколько
 * пикселей, и на тёмной сцене она читается кольцами — в вебе того же нет, потому что там
 * полотно 300 px, а не 1080. Ступени ломает шум: фильтра для этого нет, FeTurbulence
 * в react-native-svg на нативе не реализован. Картинка обычная — значит попадает в снимок
 * RenderNode, из которого стекло берёт преломление (Skia-канвас туда не попал бы).
 */
const GRAIN = require('../assets/haze-grain.png');
const GRAIN_OPACITY = 0.025;

function HazeLayer({ accent, width, height }: { accent: Accent; width: number; height: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
      <Defs>
        <LinearGradient id="base" x1={0} y1={0} x2={0} y2={height} gradientUnits="userSpaceOnUse">
          {BASE.map((color, i) => (
            <Stop key={color} offset={BASE_STOPS[i]} stopColor={color} />
          ))}
        </LinearGradient>
        {BLOB.map((blob, i) => {
          const at = (l: number) => hueHex(accent.hue + blob.hue, HAZE_S, l);
          return (
            <RadialGradient
              key={i}
              id={`haze${i}`}
              cx={width * blob.x}
              cy={height * blob.y}
              r={width * blob.radius}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={at(HAZE_L[0])} stopOpacity={blob.alpha} />
              <Stop offset="0.6" stopColor={at(HAZE_L[1])} stopOpacity={blob.alpha * 0.35} />
              <Stop offset="1" stopColor={at(HAZE_L[2])} stopOpacity={0} />
            </RadialGradient>
          );
        })}
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#base)" />
      {BLOB.map((_, i) => (
        <Rect key={i} x={0} y={0} width={width} height={height} fill={`url(#haze${i})`} />
      ))}
    </Svg>
  );
}

/** Смена трека переливается кросс-фейдом: второй слой живёт только на время перехода. */
export function HazeGround({
  accent,
  width,
  height,
}: {
  accent: Accent;
  width: number;
  height: number;
}) {
  const reduceMotion = useReduceMotion();
  const previous = useRef(accent);
  const [layers, setLayers] = useState({ from: accent, to: accent });
  const fade = useSharedValue(1);

  useEffect(() => {
    if (accent.hue === previous.current.hue) return;
    const from = previous.current;
    previous.current = accent;
    setLayers({ from, to: accent });
    fade.value = 0;
    fade.value = withTiming(1, { duration: motionDuration('ambient', reduceMotion) });
  }, [accent, reduceMotion, fade]);

  const crossfading = layers.from.hue !== layers.to.hue;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {crossfading && <HazeLayer accent={layers.from} width={width} height={height} />}
      <Animated.View style={[StyleSheet.absoluteFill, crossfading ? { opacity: fade } : null]}>
        <HazeLayer accent={layers.to} width={width} height={height} />
      </Animated.View>
      <Image source={GRAIN} resizeMode="repeat" style={styles.grain} />
    </View>
  );
}

const styles = StyleSheet.create({
  grain: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: GRAIN_OPACITY,
  },
});

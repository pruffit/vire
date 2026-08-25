import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// Настоящее «жидкое стекло» — не тонированная плашка, а SKSL-шейдер: полусферическая
// нормаль даёт объём, Френель — характерное для стекла свечение кромки, отдельный
// specular — блик источника света, хроматическая аберрация — цветную кайму по краю.
// Плоские `View`+`LinearGradient` (как в `components/glass.tsx`, инкременты 19–22) этого
// дать не могут в принципе: нет ни нормали, ни зависимости от угла обзора.
//
// Деформация — физическая, с сохранением объёма: вдоль вектора перетаскивания капля
// растягивается, поперёк сжимается, и ВСЯ картина света пересчитывается от новой формы
// (нормаль берётся от деформированной координаты, поэтому блик и аберрация едут вместе
// с формой, а не наклеены поверх).
const SOURCE = Skia.RuntimeEffect.Make(`
uniform float2 u_size;
uniform float2 u_drag;
uniform float u_press;
uniform float u_active;
uniform float4 u_tint;

// Растяжение вдоль вектора перетаскивания с поперечным сжатием (несжимаемая капля);
// без перетаскивания — squash по вертикали от силы нажатия.
float2 deform(float2 p, float2 drag, float press) {
  float d = length(drag);
  if (d < 0.5) {
    return p * float2(1.0 + press * 0.14, 1.0 - press * 0.14);
  }
  float2 dir = drag / d;
  float stretch = min(d / 55.0, 0.5);
  float along = dot(p, dir);
  float2 perp = p - dir * along;
  along /= (1.0 + stretch);
  perp *= (1.0 + stretch * 0.6);
  return dir * along + perp;
}

half4 main(float2 xy) {
  float2 c = u_size * 0.5;
  float R = min(u_size.x, u_size.y) * 0.5;
  float2 pd = deform(xy - c, u_drag, u_press);
  float r = length(pd) / R;
  if (r > 1.02) return half4(0.0);

  // Нормаль полусферы: z падает к краю — там поверхность «заворачивается».
  float rc = min(r, 1.0);
  float z = sqrt(max(0.0, 1.0 - rc * rc));
  float3 N = normalize(float3(pd / R, max(z, 0.001) * 0.9));
  float3 V = float3(0.0, 0.0, 1.0);

  // Френель: у стекла кромка всегда ярче центра — главный признак объёма.
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

  float3 L = normalize(float3(-0.45, -0.78, 0.5));
  float3 Rf = reflect(-L, N);
  float spec = pow(max(dot(Rf, V), 0.0), 46.0);
  float sheen = pow(max(dot(Rf, V), 0.0), 5.0) * 0.22;

  // Преломление уводит свет тем сильнее, чем круче поверхность.
  float refr = fres * 0.5;

  // Хроматическая аберрация: каналы преломляются по-разному → цветная кромка.
  float ca = smoothstep(0.5, 1.0, r);
  half3 chroma = half3(0.07 * ca * (1.0 + N.x), 0.03 * ca, 0.10 * ca * (1.0 - N.x));

  half3 body = half3(u_tint.rgb) + half3(refr * 0.42) + half3(sheen) + chroma + half3(spec * 1.2);

  float rim = smoothstep(0.84, 1.0, r) * (0.32 + 0.45 * fres);
  body += half3(rim * 0.6);

  // Активная — подсвеченная ИЗНУТРИ капля: свет идёт из ядра и гаснет к краю, поэтому
  // кромка остаётся стеклянной (Френель, блик и аберрация никуда не деваются). Заливка
  // сплошным цветом убила бы объём — именно этим активная кнопка и выглядела плоской.
  float core = smoothstep(1.0, 0.05, r);
  body = mix(body, body + half3(0.92) * core + half3(0.18), half(u_active));

  float alpha = u_tint.a + fres * 0.42 + rim * 0.3;
  alpha = mix(alpha, min(0.96, u_tint.a + core * 0.8 + fres * 0.45), u_active);

  float aa = 1.0 - smoothstep(0.97, 1.02, r);
  return half4(body * aa, alpha * aa);
}
`)!;

/** Насколько далеко капля тянется за пальцем, прежде чем упруго вернуться. */
const DRAG_LIMIT = 26;
const STIFFNESS = 210;
const DAMPING = 19;

type Motion = { dx: number; dy: number; press: number };
const REST: Motion = { dx: 0, dy: 0, press: 0 };

/**
 * Пружина на requestAnimationFrame. Reanimated был бы естественнее (UI-поток), но он
 * детерминированно валит нативную сборку на этой машине (`ninja: manifest still dirty`,
 * см. docs/features/mobile-app.md — тот же класс Windows-проблемы с длинными путями, что
 * ловили на armeabi-v7a). Для одного 56px-Canvas'а rAF по кадру достаточно.
 */
function useSpringMotion(): [Motion, (target: Motion, instant?: boolean) => void] {
  const [motion, setMotion] = useState<Motion>(REST);
  const state = useRef({ cur: { ...REST }, vel: { ...REST }, target: { ...REST } });
  const frame = useRef<number | null>(null);

  const tick = useCallback(() => {
    const s = state.current;
    const dt = 1 / 60;
    let moving = false;
    (['dx', 'dy', 'press'] as const).forEach((k) => {
      const delta = s.target[k] - s.cur[k];
      s.vel[k] += (delta * STIFFNESS - s.vel[k] * DAMPING) * dt;
      s.cur[k] += s.vel[k] * dt;
      if (Math.abs(delta) > 0.01 || Math.abs(s.vel[k]) > 0.01) moving = true;
    });
    setMotion({ ...s.cur });
    frame.current = moving ? requestAnimationFrame(tick) : null;
  }, []);

  const animateTo = useCallback(
    (target: Motion, instant = false) => {
      const s = state.current;
      s.target = target;
      if (instant) {
        s.cur = { ...target };
        s.vel = { ...REST };
        setMotion({ ...target });
        return;
      }
      if (frame.current === null) frame.current = requestAnimationFrame(tick);
    },
    [tick],
  );

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  return [motion, animateTo];
}

export function LiquidGlassButton({
  size,
  active = false,
  onPress,
  children,
  style,
  tint = [0.09, 0.085, 0.08, 0.2],
}: {
  size: number;
  active?: boolean;
  onPress?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** rgba тела стекла в линейном 0..1 — не цвет заливки, а тонировка преломлённого света. */
  tint?: readonly [number, number, number, number];
}) {
  const [motion, animateTo] = useSpringMotion();

  const uniforms = {
    u_size: [size, size],
    u_drag: [motion.dx, motion.dy],
    u_press: motion.press,
    u_active: active ? 1 : 0,
    u_tint: tint as unknown as number[],
  };

  const gesture = Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .onBegin(() => animateTo({ dx: 0, dy: 0, press: 1 }))
    .onChange((e) => {
      // Сопротивление: чем дальше тянут, тем неохотнее капля идёт за пальцем.
      animateTo(
        {
          dx: DRAG_LIMIT * Math.tanh(e.translationX / DRAG_LIMIT),
          dy: DRAG_LIMIT * Math.tanh(e.translationY / DRAG_LIMIT),
          press: 1,
        },
        true,
      );
    })
    .onFinalize((e, success) => {
      animateTo(REST);
      const moved = Math.hypot(e.translationX, e.translationY);
      if (success && moved < 12 && onPress) onPress();
    });

  // Иконка живёт поверх Canvas и обязана ехать вместе со стеклом — иначе видно, что
  // деформируется только подложка. Тот же закон сохранения объёма, что в шейдере.
  const d = Math.hypot(motion.dx, motion.dy);
  const stretch = Math.min(d / 55, 0.5);
  const dirX = d > 0.5 ? motion.dx / d : 0;
  const dirY = d > 0.5 ? motion.dy / d : 0;

  return (
    <GestureDetector gesture={gesture}>
      <View style={[{ width: size, height: size }, style]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={SOURCE} uniforms={uniforms} />
          </Fill>
        </Canvas>
        <View
          style={[
            styles.content,
            {
              transform: [
                { translateX: motion.dx * 0.55 },
                { translateY: motion.dy * 0.55 },
                { scaleX: 1 + stretch * 0.35 * Math.abs(dirX) - motion.press * 0.06 },
                { scaleY: 1 + stretch * 0.35 * Math.abs(dirY) - motion.press * 0.06 },
              ],
            },
          ]}
        >
          {children}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

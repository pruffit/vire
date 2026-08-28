import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';
import { LiquidGlassButton } from '../components/liquid-glass';
import type { IconName } from '../lib/icon';

// Сцены для замера масштабирования (docs/vireglass/benchmarks/). Меряется ПРОДОВЫЙ
// компонент LiquidGlassButton, а не упрощённая модель — иначе цифры не о том.
//
// Фон анимирован постоянно: без непрерывной перерисовки gfxinfo не наберёт кадров, а
// dimezisBlurView не станет перезахватывать контент. Высокочастотный фон (полосы + текст)
// выбран намеренно: на плоской заливке блюр не даёт нагрузки, характерной для реального UI.
//
// Протокол замера — docs/vireglass/benchmarks/README.md.

// 2 — рабочая точка продукта: таб-бар + мини-плеер, столько стеклянных поверхностей
// видно одновременно в реальном UI. Остальные значения нужны, чтобы увидеть форму
// зависимости, а не только рабочую точку.
const COUNTS = [1, 2, 3, 6, 10] as const;
const ICONS: IconName[] = ['home', 'search', 'list', 'user'];

function MovingBackdrop() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.linear }), -1, false);
  }, [t]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -220 * t.value }] }));

  return (
    <Animated.View style={[styles.bgLayer, style]}>
      {Array.from({ length: 40 }, (_, i) => (
        <View key={i} style={[styles.bgRow, { backgroundColor: i % 2 ? '#1b2328' : '#2a353b' }]}>
          <Text style={styles.bgText}>VIREGLASS · {String(i).padStart(2, '0')} · высокочастотный фон</Text>
        </View>
      ))}
    </Animated.View>
  );
}

export function GlassBench() {
  // Цель блюра обязана быть BlurTargetView из expo-blur, а не обычной View: на обычной
  // нативный проп blurTargetId не ставится («Cannot set prop blurTargetId»), захват фона
  // молча не включается — и замер уходит мимо самой дорогой части конвейера.
  const targetRef = useRef<View>(null);
  const [count, setCount] = useState<number>(1);
  // Без отступа на системную навигацию панель управления оказывается ПОД ней и не
  // нажимается: тап уходит в системные кнопки, сцена молча не переключается.
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {/* Цель блюра оборачивает ТОЛЬКО фон. Стёкла — снаружи неё, как в проде (таб-бар и
          мини-плеер живут вне экрана). Положить стекло ВНУТРЬ своей же цели нельзя:
          dimezis рисует цель в себя, дерево RenderNode замыкается и рантайм падает
          переполнением стека в prepareTreeImpl. Проверено — воспроизводится за секунды. */}
      <BlurTargetView style={StyleSheet.absoluteFill} ref={targetRef}>
        <MovingBackdrop />
      </BlurTargetView>

      <View style={styles.glassRow}>
        {Array.from({ length: count }, (_, i) => (
          <LiquidGlassButton
            key={i}
            size={58}
            icon={ICONS[i % ICONS.length]}
            blurTarget={targetRef}
            active={i === 0}
          />
        ))}
      </View>

      <ScrollView horizontal style={[styles.controlsWrap, { bottom: insets.bottom + 12 }]} contentContainerStyle={styles.controls}>
        {COUNTS.map((c) => (
          <Pressable
            key={c}
            style={[styles.btn, count === c && styles.btnActive]}
            onPress={() => setCount(c)}
          >
            <Text style={styles.btnText}>{c} стекол</Text>
          </Pressable>
        ))}
        <Pressable style={styles.btn} onPress={() => setCount(0)}>
          <Text style={styles.btnText}>0 (контроль)</Text>
        </Pressable>
      </ScrollView>

      <Text style={styles.hud}>стекол на сцене: {count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1114', overflow: 'hidden' },
  bgLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
  bgRow: { height: 44, justifyContent: 'center', paddingHorizontal: 12 },
  bgText: { color: '#7f9099', fontSize: 12, letterSpacing: 1 },
  glassRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 160,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  controlsWrap: { position: 'absolute', left: 0, right: 0, flexGrow: 0 },
  controls: { gap: 8, paddingHorizontal: 12, alignItems: 'center' },
  btn: { backgroundColor: '#1b2328', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnActive: { backgroundColor: '#14322f', borderWidth: 1, borderColor: '#5ecfc6' },
  btnText: { color: '#e6ecef', fontSize: 12 },
  hud: { position: 'absolute', top: 44, left: 16, color: '#5ecfc6', fontSize: 12, fontWeight: '600' },
});

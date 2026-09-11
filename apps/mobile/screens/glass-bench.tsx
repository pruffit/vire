import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/backdrop';
import { LiquidGlassButton } from '../components/liquid-glass';
import { VireGlassSurface } from '../components/vireglass/glass-surface';
import { useEnvironmentLight } from '../lib/vireglass/environment';
import { capsuleGeometry, circleGeometry, roundedRectGeometry } from '../lib/vireglass/geometry';
import { applyToggles, LEGACY_OPTICS } from '../lib/vireglass/material';
import type { IconName } from '../lib/icon';

// Сцены замера (docs/vireglass/benchmarks/). Эксперимент «счёт» гоняет ПРОДОВЫЙ
// LiquidGlassButton, чтобы цифры были сравнимы с прежними прогонами; эксперимент «площадь»
// работает через VireGlassSurface, потому что кнопка умеет только круг.
//
// Фон анимирован постоянно: без непрерывной перерисовки gfxinfo не наберёт кадров, а
// dimezisBlurView не станет перезахватывать контент.
//
// Протокол замера — docs/vireglass/benchmarks/README.md.

const COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const ICONS: IconName[] = ['home', 'search', 'list', 'user'];

/** Продовый размер круглой кнопки таб-бара (navigation/main-tabs.tsx). */
const BUTTON = 68;
/** Высота полосы мини-плеера (lib/layout.ts) и её боковые отступы. */
const MINI_PLAYER_H = 60;
const SIDE_MARGIN = 12;

// Опорная точка изолирует ровно смещение выборки: RenderEffect накладывается в обоих
// материалах, но здесь оно вырождено (увеличение 1, смещение 0, аберрации 0). Это НЕ конвейер
// до Phase 3 — там линза не включалась вовсе, и воспроизвести то состояние отсюда нечем
// (material-lab.md E-01).
const MATERIALS = {
  'без преломления': {
    ...applyToggles(LEGACY_OPTICS['v1'], { refraction: false, dispersion: false }),
    blur: 9,
  },
  'Material v1': LEGACY_OPTICS['v1'],
};

type MaterialName = keyof typeof MATERIALS;
const MATERIAL_NAMES = Object.keys(MATERIALS) as MaterialName[];

type SizeName = 'кнопка' | 'мини-плеер' | 'таб-бар' | 'панель';
const SIZE_NAMES: SizeName[] = ['кнопка', 'мини-плеер', 'таб-бар', 'панель'];

type Mode = 'счёт' | 'площадь';
const MODES: Mode[] = ['счёт', 'площадь'];

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

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.btn, on && styles.btnActive]} onPress={onPress}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export function GlassBench() {
  // Цель обязана быть `Backdrop`, а не обычной View: на обычной
  // нативный проп blurTargetId не ставится («Cannot set prop blurTargetId»), захват фона
  // молча не включается — и замер уходит мимо самой дорогой части конвейера.
  const targetRef = useRef<View>(null);
  const [count, setCount] = useState<number>(1);
  const [material, setMaterial] = useState<MaterialName>('Material v1');
  const [size, setSize] = useState<SizeName>('кнопка');
  const [mode, setMode] = useState<Mode>('счёт');
  // Без отступа на системную навигацию панель управления оказывается ПОД ней и не
  // нажимается: тап уходит в системные кнопки, сцена молча не переключается.
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const wide = Math.round(width - SIDE_MARGIN * 2);
  const geometry = useMemo(() => {
    switch (size) {
      case 'мини-плеер':
        return roundedRectGeometry(wide, MINI_PLAYER_H, 18);
      case 'таб-бар':
        return capsuleGeometry(wide, 76);
      case 'панель':
        return roundedRectGeometry(wide, 320, 24);
      default:
        return circleGeometry(BUTTON);
    }
  }, [size, wide]);

  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const press = useSharedValue(0);
  const active = useSharedValue(0);
  const light = useEnvironmentLight(0);

  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={styles.root}>
      {/* Цель блюра оборачивает ТОЛЬКО фон. Стёкла — снаружи неё, как в проде (таб-бар и
          мини-плеер живут вне экрана). Положить стекло ВНУТРЬ своей же цели нельзя:
          dimezis рисует цель в себя, дерево RenderNode замыкается и рантайм падает
          переполнением стека в prepareTreeImpl. Проверено — воспроизводится за секунды. */}
      <Backdrop style={StyleSheet.absoluteFill} targetRef={targetRef}>
        <MovingBackdrop />
      </Backdrop>

      <View style={[styles.glassRow, mode === 'площадь' && styles.glassColumn]}>
        {items.map((i) =>
          mode === 'счёт' ? (
            <LiquidGlassButton
              key={i}
              size={BUTTON}
              icon={ICONS[i % ICONS.length]}
              blurTarget={targetRef}
              active={i === 0}
              optics={MATERIALS[material]}
            />
          ) : (
            <VireGlassSurface
              key={i}
              geometry={geometry}
              optics={MATERIALS[material]}
              dynamics={{ shiftX, shiftY, press, active, light }}
              blurTarget={targetRef}
            />
          ),
        )}
      </View>

      <Text style={styles.hud}>
        {mode} · {mode === 'счёт' ? 'кнопка' : size} · стёкол {count} · {material}
        {'\n'}
        {geometry.width}×{geometry.height} dp
      </Text>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.row}>
          {MODES.map((m) => (
            <Chip key={m} label={m} on={mode === m} onPress={() => setMode(m)} />
          ))}
          {MATERIAL_NAMES.map((n) => (
            <Chip key={n} label={n} on={material === n} onPress={() => setMaterial(n)} />
          ))}
        </View>
        <View style={styles.row}>
          {COUNTS.map((c) => (
            <Chip key={c} label={String(c)} on={count === c} onPress={() => setCount(c)} />
          ))}
        </View>
        <View style={styles.row}>
          {SIZE_NAMES.map((s) => (
            <Chip key={s} label={s} on={size === s} onPress={() => setSize(s)} />
          ))}
        </View>
      </View>
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
    top: 150,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: SIDE_MARGIN,
    justifyContent: 'center',
  },
  glassColumn: { flexDirection: 'column', alignItems: 'center' },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 6,
    paddingHorizontal: 10,
    backgroundColor: '#0a0e11f2',
    paddingTop: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { backgroundColor: '#1b2328', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  btnActive: { backgroundColor: '#14322f', borderWidth: 1, borderColor: '#5ecfc6' },
  btnText: { color: '#e6ecef', fontSize: 12 },
  hud: { position: 'absolute', top: 44, left: 16, color: '#5ecfc6', fontSize: 12, fontWeight: '600' },
});

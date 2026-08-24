import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useBlurTarget } from '../lib/blur-target';

// «Дым» — единственная стеклянная поверхность кита (design-канвасы этой сессии: «VireMusic
// UI Kit» §02 + «VireMusic Glass» turn 4 «единые правила стекла»): нейтральное графитовое
// стекло, accent живёт в контенте/блике под стеклом, а не красит саму поверхность — поэтому
// тут нет пропа под тему артиста. Правило кита: стекло ТОЛЬКО на плавающих слоях (навигация,
// мини-плеер, шапки на скролле, sheets, composer, поиск) — максимум 2–3 стеклянные
// поверхности на экран одновременно, Android blur дороже iOS (см. §07 кита).
//
// Реальный блюр на Android (`blurMethod="dimezisBlurView"` + `blurTarget`) — живой прогон на
// эмуляторе поймал нативный краш (SIGSEGV в RenderThread), когда `BlurTargetView` оборачивала
// ВЕСЬ навигатор: её кастомный `ViewGroup` (переопределяет addView/removeView) конфликтует
// с Fabric-рендерингом `react-native-screens` на уровне стеков/экранов. Тот же прогон
// подтвердил: обёртка ТОЛЬКО вокруг контента одного экрана (лист, без вложенных
// Screen-контейнеров) не крашит и реально блюрит. Поэтому `blurTarget` берётся из
// `useBlurTarget()` (`lib/blur-target.tsx`) — общий контекст, в который каждый экран
// регистрирует свой ЛОКАЛЬНЫЙ `BlurTargetView` через `useRegisterBlurTarget` при фокусе; до
// первого рендера/регистрации `target` — `null`, и `BlurView` по документации сама
// деградирует до полупрозрачной плашки без блюра (состояние «reduced» из кита, легитимный
// фолбэк, не полумера). См. docs/features/mobile-app.md «Инкремент 19»/«21»/«22».
const GLASS_TINT = 'rgba(18,16,14,0.4)';
const SHEEN_TOP = 'rgba(255,255,255,0.11)';
const EDGE = 'rgba(255,255,255,0.10)';
const SPECULAR = ['transparent', 'rgba(255,255,255,0.55)', 'transparent'] as const;

export function Glass({
  children,
  style,
  radius = 20,
  intensity = 40,
  accentRim,
  edge = true,
  shadow = true,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** 0–100, экспериментально — подобрано визуально по мокапам, не измерено на устройстве. */
  intensity?: number;
  /** Нижняя rim-линия цветом текущего контента (обложка/артист) — опционально, по умолчанию нет. */
  accentRim?: string;
  /** Полная окантовка + внешняя тень — выключать для полноширинных пристыкованных панелей
   *  (таб-бар), где вместо этого нужна только верхняя specular-линия, см. edge:'top' ниже. */
  edge?: boolean | 'top';
  shadow?: boolean;
}) {
  const blurTarget = useBlurTarget();

  return (
    <View style={[styles.container, { borderRadius: radius }, edge === true && styles.fullEdge, shadow && styles.shadow, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        blurTarget={blurTarget ?? undefined}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      <LinearGradient colors={[SHEEN_TOP, 'transparent']} style={StyleSheet.absoluteFill} />
      {edge && (
        <LinearGradient
          colors={SPECULAR}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.specular}
        />
      )}
      {accentRim && (
        <LinearGradient
          colors={['transparent', accentRim, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.rim, { opacity: 0.4 }]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  fullEdge: { borderWidth: 1, borderColor: EDGE },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  tint: { backgroundColor: GLASS_TINT },
  specular: { position: 'absolute', left: 16, right: 16, top: 0, height: 1 },
  rim: { position: 'absolute', left: 16, right: 16, bottom: 0, height: 1 },
});

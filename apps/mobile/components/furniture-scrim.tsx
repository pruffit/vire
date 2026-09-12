import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { scrimColors, SCRIM_STOPS } from '../lib/design/scroll-edge';
import { useScrimHeight } from '../lib/layout';
import { useScrollEdgePaint } from '../lib/scroll-edge';

/**
 * Краевой эффект прокрутки у нижней мебели — мини-плеера и навигации (эталон
 * `docs/vireglass/reference.md` §10).
 *
 * Ставится ПОСЛЕДНИМ ребёнком цели блюра — то есть поверх контента, но внутри того, что
 * захватывает линза. Так стекло видит уже приглушённый фон и остаётся стеклом; вынесенный
 * наружу, этот градиент линзе не виден, и деталь приходилось гасить саму — вместо стекла
 * получался чёрный пластик.
 *
 * Эффект — работа ЭКРАНА, а не материала: материал отвечает за то, что видно сквозь него, а
 * за то, что лежит в зазорах между деталями, отвечать ему нечем.
 */
export function FurnitureScrim() {
  const height = useScrimHeight();
  const { strength, style } = useScrollEdgePaint();
  // Вне провайдера (стенды материала) канала нет, и край остаётся полным, как раньше.
  const fallback = useSharedValue(1);
  const value = strength ?? fallback;
  const fade = useAnimatedStyle(() => ({ opacity: value.value }));

  return (
    <Animated.View pointerEvents="none" style={[styles.scrim, { height }, fade]}>
      <LinearGradient
        colors={scrimColors(style)}
        locations={SCRIM_STOPS}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

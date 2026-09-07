import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SCRIM_COLORS, SCRIM_STOPS, useScrimHeight } from '../lib/layout';

/**
 * Притенение низа экрана под мини-плеером и навигацией.
 *
 * Ставится ПОСЛЕДНИМ ребёнком цели блюра — то есть поверх контента, но внутри того, что
 * захватывает линза. Так стекло видит уже приглушённый фон и остаётся стеклом; вынесенный
 * наружу, этот градиент линзе не виден, и деталь приходилось гасить саму — вместо стекла
 * получался чёрный пластик.
 *
 * Скрим — работа ЭКРАНА, а не материала: материал отвечает за то, что видно сквозь него, а
 * за то, что лежит в зазорах между деталями, отвечать ему нечем.
 */
export function FurnitureScrim() {
  const height = useScrimHeight();

  return (
    <LinearGradient
      pointerEvents="none"
      colors={SCRIM_COLORS}
      locations={SCRIM_STOPS}
      style={[styles.scrim, { height }]}
    />
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

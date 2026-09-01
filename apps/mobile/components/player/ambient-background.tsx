import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { motionDuration } from '../../lib/design/scales';
import { useReduceMotion } from '../../lib/design/preferences';

const SCALE = 2.2;
const BLUR_RADIUS = 60;

/** Затемнение под хром: обложка светлеет к середине и тонет к краям, где стоят
 *  грабхэндл сверху и заголовок с волной снизу. */
const SCRIM = ['rgba(3,2,1,0.78)', 'rgba(3,2,1,0.28)', 'rgba(3,2,1,0.72)', 'rgba(3,2,1,0.94)'] as const;
const SCRIM_STOPS = [0, 0.34, 0.72, 1] as const;

/**
 * Фон экрана 1 — увеличенная и размытая обложка. Блюр даёт сам `expo-image`
 * (`blurRadius`), кросс-фейд при смене трека — его же `transition`. Затемнение —
 * градиент, а не второй `BlurView`: размывать уже размытое незачем, а лишняя
 * блюр-поверхность стоит кадров.
 */
export function AmbientBackground({ coverUrl }: { coverUrl: string | null | undefined }) {
  const reduceMotion = useReduceMotion();
  if (!coverUrl) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: coverUrl }}
        style={[StyleSheet.absoluteFill, styles.art]}
        contentFit="cover"
        blurRadius={BLUR_RADIUS}
        transition={motionDuration('ambient', reduceMotion)}
      />
      <LinearGradient colors={SCRIM} locations={SCRIM_STOPS} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  art: { transform: [{ scale: SCALE }] },
});

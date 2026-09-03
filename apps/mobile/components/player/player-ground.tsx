import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { motionDuration } from '../../lib/design/scales';
import { useReduceMotion } from '../../lib/design/preferences';
import type { Accent } from '../../lib/design/accent';

const SCALE = 2.4;
const BLUR_RADIUS = 60;
/** Размытая обложка поверх тона — фактура, а не фон: в полную силу она забивает акцент. */
const ART_OPACITY = 0.5;

const GROUND_STOPS = [0, 0.46, 1] as const;
/** Обложка живёт только вверху: под управлением и списком фон обязан замолчать. */
const VEIL_STOPS = [0.12, 0.52, 0.82] as const;

/**
 * Фон плеера: градиент в тон трека, поверх — размытая обложка, поверх неё — вуаль теми же
 * ступенями с альфа-рампой.
 *
 * Раньше это была плоская заливка одним затемнённым цветом и один фейд в чёрное — на
 * экране читалось грязным пятном. Ступени берутся из акцента в HSL (`resolveAccent`): тон
 * и насыщенность держатся, вниз уходит только светлота, поэтому цвет остаётся цветом.
 *
 * Вуаль набрана ЦВЕТОМ ФОНА, а не чёрным: чёрным она темнила бы сам градиент под обложкой
 * и низ экрана проваливался бы в грязь.
 */
export function PlayerGround({
  coverUrl,
  accent,
}: {
  coverUrl: string | null | undefined;
  accent: Accent;
}) {
  const reduceMotion = useReduceMotion();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[...accent.gradient]}
        locations={[...GROUND_STOPS]}
        style={StyleSheet.absoluteFill}
      />
      {coverUrl && (
        <>
          <Image
            source={{ uri: coverUrl }}
            style={[StyleSheet.absoluteFill, styles.art]}
            contentFit="cover"
            blurRadius={BLUR_RADIUS}
            transition={motionDuration('ambient', reduceMotion)}
          />
          <LinearGradient
            colors={[...accent.veil]}
            locations={[...VEIL_STOPS]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { transform: [{ scale: SCALE }], opacity: ART_OPACITY },
});

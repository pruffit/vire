import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../lib/theme';
import { motionDuration } from '../../lib/design/scales';
import { useReduceMotion } from '../../lib/design/preferences';

const SCALE = 2.2;
const BLUR_RADIUS = 60;
/** Размытая обложка поверх тона — фактура, а не фон: в полную силу она забивает акцент. */
const ART_OPACITY = 0.5;

/** Книзу цвет уходит в палитру приложения: под управлением и списком фон обязан замолчать. */
const FADE = ['rgba(3,2,1,0)', 'rgba(3,2,1,0.45)', colors.background] as const;
const FADE_STOPS = [0, 0.55, 1] as const;

/**
 * Фон плеера: тон от акцента темы артиста плюс размытая обложка.
 *
 * До этого фон был одинаково чёрным у всех треков, и экран не имел лица. Цвет берётся
 * сильно затемнённым (`resolveAccent`), иначе он спорит с обложкой, ради которой экран
 * и открывают.
 */
export function PlayerGround({ coverUrl, ground }: { coverUrl: string | null | undefined; ground: string }) {
  const reduceMotion = useReduceMotion();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: ground }]} pointerEvents="none">
      {coverUrl && (
        <Image
          source={{ uri: coverUrl }}
          style={[StyleSheet.absoluteFill, styles.art]}
          contentFit="cover"
          blurRadius={BLUR_RADIUS}
          transition={motionDuration('ambient', reduceMotion)}
        />
      )}
      <LinearGradient colors={FADE} locations={FADE_STOPS} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  art: { transform: [{ scale: SCALE }], opacity: ART_OPACITY },
});

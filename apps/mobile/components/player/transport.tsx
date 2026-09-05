import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from '../../lib/icon';
import { colors } from '../../lib/theme';
import { layout, radii } from '../../lib/design/scales';
import type { Accent } from '../../lib/design/accent';

const PLAY_SIZE = 68;
const STEP_SIZE = 30;
const MODE_SIZE = 20;

/**
 * Главный ряд управления. Плоский, без стекла: под ним затемнённый край ambient-фона —
 * преломлять там нечего, и стеклянная капсула читалась бы как выключенная.
 *
 * Режимы (перемешать/повтор) стоят по краям того же ряда: это тоже управление
 * воспроизведением, и разносить их по разным блокам незачем.
 */
export function Transport({
  playing,
  loading,
  accent,
  hasNext,
  hasPrev,
  shuffle,
  repeat,
  onPrev,
  onNext,
  onTogglePlay,
  onToggleShuffle,
  onCycleRepeat,
}: {
  playing: boolean;
  loading: boolean;
  /** Цвет темы артиста: главная кнопка — единственное место, где он берётся в полную силу. */
  accent: Accent;
  hasNext: boolean;
  hasPrev: boolean;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
}) {
  const tap = (fn: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fn();
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={tap(onToggleShuffle)}
        style={styles.side}
        accessibilityRole="button"
        accessibilityState={{ selected: shuffle }}
        accessibilityLabel="Перемешать"
      >
        <Icon name="shuffle" size={MODE_SIZE} color={shuffle ? colors.foreground : colors.mutedForeground} />
      </Pressable>

      <Pressable
        onPress={tap(onPrev)}
        disabled={!hasPrev}
        style={styles.step}
        accessibilityRole="button"
        accessibilityLabel="Предыдущий трек"
      >
        <Icon name="skip-back" size={STEP_SIZE} color={hasPrev ? colors.foreground : colors.mutedForeground} />
      </Pressable>

      <Pressable
        onPress={tap(onTogglePlay)}
        style={[styles.play, { backgroundColor: accent.fill }]}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Пауза' : 'Играть'}
      >
        {loading ? (
          <ActivityIndicator color={accent.ink} />
        ) : (
          <Icon name={playing ? 'pause' : 'play'} size={30} color={accent.ink} />
        )}
      </Pressable>

      <Pressable
        onPress={tap(onNext)}
        disabled={!hasNext}
        style={styles.step}
        accessibilityRole="button"
        accessibilityLabel="Следующий трек"
      >
        <Icon name="skip-forward" size={STEP_SIZE} color={hasNext ? colors.foreground : colors.mutedForeground} />
      </Pressable>

      <Pressable
        onPress={tap(onCycleRepeat)}
        style={styles.side}
        accessibilityRole="button"
        accessibilityState={{ selected: repeat !== 'off' }}
        accessibilityLabel={repeat === 'one' ? 'Повтор одного трека' : 'Повтор'}
      >
        <View style={styles.modeIcon}>
          <Icon name="repeat" size={MODE_SIZE} color={repeat !== 'off' ? colors.foreground : colors.mutedForeground} />
          {repeat === 'one' && <View style={styles.repeatDot} />}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIcon: { width: MODE_SIZE, height: MODE_SIZE, alignItems: 'center', justifyContent: 'center' },
  repeatDot: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 5,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.foreground,
  },
});

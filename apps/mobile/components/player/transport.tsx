import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from '../../lib/icon';
import { colors } from '../../lib/theme';
import { radii } from '../../lib/design/scales';
import { useMock } from '../../lib/design/mock';
import { textAlpha } from '../../lib/design/typography';

const STEP_DIVISOR = 4.6;
/** Кегли значков в макете; на экране пересчитываются пропорцией (lib/design/mock.ts). */
const MOCK_SIDE = 19;
const MOCK_SKIP = 26;
const MOCK_PLAY = 34;
const SIDE_ALPHA = 0.5;
const SKIP_ALPHA = 0.85;
/** Тач-зона кита: значок своего размера, до неё добирает бокс. */
const TOUCH_TARGET = 48;

/**
 * Главный ряд управления. Плоский, без стекла и подложек: иерархия держится размером
 * и плотностью краски кнопки, не рамкой вокруг неё.
 *
 * Режимы (перемешать/повтор) стоят по краям того же ряда: это тоже управление
 * воспроизведением, и разносить их по разным блокам незачем.
 */
export function Transport({
  playing,
  loading,
  hasNext,
  hasPrev,
  shuffle,
  repeat,
  onPrev,
  onNext,
  onTogglePlay,
  onToggleShuffle,
  onCycleRepeat,
  width,
}: {
  playing: boolean;
  loading: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  /** Ширина поля экрана: шаг между центрами кнопок = ширина / 4.6. */
  width: number;
}) {
  const tap = (fn: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fn();
  };
  const ms = useMock();
  const side = ms(MOCK_SIDE);
  const skip = ms(MOCK_SKIP);
  const play = ms(MOCK_PLAY);
  // Все боксы одной ширины (тач-зона кита), поэтому шаг между центрами держит обычный gap.
  // Ряд в макете высотой с главный значок; до тач-зоны кита добирает hitSlop, а не бокс —
  // раздутый до 48 бокс поднимал всю стопку и съедал обложку.
  const box = play;
  const slop = Math.max(0, Math.round((TOUCH_TARGET - box) / 2));
  const gap = Math.max(0, width / STEP_DIVISOR - box);

  const boxStyle = { width: box, height: box, alignItems: 'center', justifyContent: 'center' } as const;

  return (
    <View style={[styles.row, { gap }]}>
      <Pressable
        onPress={tap(onToggleShuffle)}
        style={[boxStyle, { opacity: shuffle ? 1 : SIDE_ALPHA }]} hitSlop={slop}
        accessibilityRole="button"
        accessibilityState={{ selected: shuffle }}
        accessibilityLabel="Перемешать"
      >
        <Icon name="shuffle" size={side} color={colors.foreground} />
      </Pressable>

      <Pressable
        onPress={tap(onPrev)}
        disabled={!hasPrev}
        style={[boxStyle, { opacity: hasPrev ? SKIP_ALPHA : textAlpha.disabled }]} hitSlop={slop}
        accessibilityRole="button"
        accessibilityLabel="Предыдущий трек"
      >
        <Icon name="skip-back" size={skip} color={colors.foreground} />
      </Pressable>

      <Pressable
        onPress={tap(onTogglePlay)}
        style={boxStyle} hitSlop={slop}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Пауза' : 'Играть'}
      >
        {loading ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <Icon name={playing ? 'pause' : 'play'} size={play} color={colors.foreground} />
        )}
      </Pressable>

      <Pressable
        onPress={tap(onNext)}
        disabled={!hasNext}
        style={[boxStyle, { opacity: hasNext ? SKIP_ALPHA : textAlpha.disabled }]} hitSlop={slop}
        accessibilityRole="button"
        accessibilityLabel="Следующий трек"
      >
        <Icon name="skip-forward" size={skip} color={colors.foreground} />
      </Pressable>

      <Pressable
        onPress={tap(onCycleRepeat)}
        style={[boxStyle, { opacity: repeat !== 'off' ? 1 : SIDE_ALPHA }]} hitSlop={slop}
        accessibilityRole="button"
        accessibilityState={{ selected: repeat !== 'off' }}
        accessibilityLabel={repeat === 'one' ? 'Повтор одного трека' : 'Повтор'}
      >
        <View style={styles.modeIcon}>
          <Icon name="repeat" size={side} color={colors.foreground} />
          {repeat === 'one' && <View style={styles.repeatDot} />}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  modeIcon: { alignItems: 'center', justifyContent: 'center' },
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

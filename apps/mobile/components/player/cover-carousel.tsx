import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { QueueTrack } from '../../lib/player-store';
import { space } from '../../lib/design/scales';
import { Cover } from '../ui/cover';
import { Icon } from '../../lib/icon';
import { colors } from '../../lib/theme';

/** Доля ширины обложки, на которой сосед доходит до полной своей плотности. */
const NEIGHBOUR_REVEAL = 0.5;
/** Сосед не спорит с текущей обложкой за внимание. */
const NEIGHBOUR_ALPHA = 0.38;
const GAP = space.lg;
const AXIS_LOCK = 10;
const SWIPE_COMMIT = 64;
const DISMISS_COMMIT = 90;
const COMMIT_OUT = 190;
const CAROUSEL_SPRING = { mass: 0.6, damping: 18, stiffness: 220 };
const DISMISS_SPRING = { mass: 0.6, damping: 20, stiffness: 260 };
const BURST_IN = 150;
const BURST_HOLD = 150;
const BURST_OUT = 300;

type Axis = 'none' | 'x' | 'y';

/**
 * Жестовая область обложки: карусель треков, дисмисс вниз, иммерсив по тапу, лайк по
 * двойному тапу, лист действий по долгому нажатию.
 *
 * Ось решается порогами активации, а не в `onChange`: свайп ВВЕРХ обязан достаться
 * ScrollView (обложка занимает большую часть первого экрана, и пролистывать страницу
 * пальцем по ней — основной способ добраться до текста и очереди). Поэтому Pan
 * активируется только на горизонталь и на движение вниз.
 */
export function CoverCarousel({
  queue,
  queueIndex,
  size,
  radius,
  immersive,
  edgeScale,
  immersiveShiftY,
  reduceMotion,
  onTap,
  onDoubleTap,
  onLongPress,
  onSwipeNext,
  onSwipePrev,
  onDismiss,
}: {
  queue: QueueTrack[];
  queueIndex: number;
  size: number;
  radius: number;
  immersive: SharedValue<number>;
  edgeScale: number;
  /** Сдвиг до центра вьюпорта: обложка стоит выше центра, и без него иммерсив не
   *  закрывает нижнюю кромку экрана. */
  immersiveShiftY: number;
  reduceMotion: boolean;
  onTap: () => void;
  onDoubleTap: () => void;
  onLongPress: () => void;
  onSwipeNext: () => void;
  onSwipePrev: () => void;
  onDismiss: () => void;
}) {
  const track = queue[queueIndex];
  const prevTrack = queueIndex > 0 ? queue[queueIndex - 1] : null;
  const nextTrack = queueIndex < queue.length - 1 ? queue[queueIndex + 1] : null;

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const burst = useSharedValue(0);
  const axisRef = useRef<Axis>('none');
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    },
    [],
  );

  const gesture = useMemo(() => {
    const settle = (sv: typeof dragX, config: typeof CAROUSEL_SPRING) => {
      sv.value = reduceMotion ? 0 : withSpring(0, config);
    };

    // Обложка доезжает до края и только потом меняется трек: смена индекса
    // синхронна, и без задержки соседняя обложка телепортировалась бы в центр.
    const commit = (direction: -1 | 1, advance: () => void) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (reduceMotion) {
        dragX.value = 0;
        advance();
        return;
      }
      dragX.value = withTiming(direction * (size + GAP), { duration: COMMIT_OUT });
      commitTimer.current = setTimeout(() => {
        advance();
        dragX.value = 0;
      }, COMMIT_OUT);
    };

    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-AXIS_LOCK, AXIS_LOCK])
      .activeOffsetY([AXIS_LOCK, Number.MAX_SAFE_INTEGER])
      .onBegin(() => {
        axisRef.current = 'none';
      })
      .onChange((e) => {
        if (axisRef.current === 'none') {
          if (Math.abs(e.translationX) > AXIS_LOCK || Math.abs(e.translationY) > AXIS_LOCK) {
            axisRef.current = Math.abs(e.translationX) > Math.abs(e.translationY) ? 'x' : 'y';
          }
        }
        if (axisRef.current === 'x') {
          const past = (e.translationX > 0 && !prevTrack) || (e.translationX < 0 && !nextTrack);
          dragX.value = past ? e.translationX * 0.3 : e.translationX;
        } else if (axisRef.current === 'y' && e.translationY > 0) {
          dragY.value = e.translationY;
        }
      })
      .onEnd(() => {
        if (axisRef.current === 'x') {
          if (dragX.value <= -SWIPE_COMMIT && nextTrack) commit(-1, onSwipeNext);
          else if (dragX.value >= SWIPE_COMMIT && prevTrack) commit(1, onSwipePrev);
          else settle(dragX, CAROUSEL_SPRING);
        } else if (axisRef.current === 'y') {
          if (dragY.value >= DISMISS_COMMIT) onDismiss();
          else settle(dragY, DISMISS_SPRING);
        }
        axisRef.current = 'none';
      });

    const doubleTap = Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(2)
      .maxDelay(200)
      .onEnd(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (reduceMotion) {
          burst.value = 1;
          setTimeout(() => {
            burst.value = 0;
          }, BURST_HOLD);
        } else {
          burst.value = withSequence(
            withTiming(1, { duration: BURST_IN }),
            withTiming(1, { duration: BURST_HOLD }),
            withTiming(0, { duration: BURST_OUT }),
          );
        }
        onDoubleTap();
      });

    const singleTap = Gesture.Tap().runOnJS(true).numberOfTaps(1).onEnd(() => onTap());
    const taps = Gesture.Exclusive(doubleTap, singleTap);
    const longPress = Gesture.LongPress().runOnJS(true).minDuration(420).onStart(() => onLongPress());

    return Gesture.Race(pan, longPress, taps);
  }, [
    prevTrack,
    nextTrack,
    reduceMotion,
    size,
    onSwipeNext,
    onSwipePrev,
    onDismiss,
    onTap,
    onDoubleTap,
    onLongPress,
    dragX,
    dragY,
    burst,
  ]);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
  }));

  const coverStyle = useAnimatedStyle(() => {
    const scale = 1 + (edgeScale - 1) * immersive.value;
    return {
      borderRadius: radius * (1 - immersive.value),
      transform: [{ translateY: immersiveShiftY * immersive.value }, { scale }],
    };
  });

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 0.6 + burst.value * 0.6 }],
  }));

  // Соседи проявляются ТОЛЬКО на протяжке. В покое они торчали за полем экрана — обложка
  // переставала быть одним предметом. Обрезать их нельзя: на том же боксе построен
  // иммерсив, и клип срезал бы обложку, разъезжающуюся на весь экран.
  const neighbourStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(dragX.value) / (size * NEIGHBOUR_REVEAL)) * NEIGHBOUR_ALPHA,
  }));

  if (!track) return null;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{ width: size, height: size }}
        accessibilityRole="image"
        accessibilityLabel={`${track.title}, ${track.artistName}`}
      >
        <Animated.View style={[styles.strip, { width: size, height: size }, stripStyle]}>
          {prevTrack && (
            <Animated.View
              style={[styles.slot, { width: size, height: size, left: -size - GAP }, neighbourStyle]}
            >
              <Cover uri={prevTrack.coverUrl} size={size} radius={radius} />
            </Animated.View>
          )}
          <Animated.View style={[styles.slot, { width: size, height: size, overflow: 'hidden' }, coverStyle]}>
            <Cover uri={track.coverUrl} size={size} radius={0} />
          </Animated.View>
          {nextTrack && (
            <Animated.View
              style={[styles.slot, { width: size, height: size, left: size + GAP }, neighbourStyle]}
            >
              <Cover uri={nextTrack.coverUrl} size={size} radius={radius} />
            </Animated.View>
          )}
        </Animated.View>
        <Animated.View style={[styles.burst, burstStyle]} pointerEvents="none">
          <Icon name="heart" size={72} color={colors.primary} filled />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  strip: { position: 'relative' },
  slot: { position: 'absolute', top: 0, left: 0 },
  burst: { position: 'absolute', top: '50%', left: '50%', marginLeft: -36, marginTop: -36 },
});

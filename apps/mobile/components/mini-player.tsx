import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { usePlayerStore } from '../lib/player-store';
import type { RootStackParamList } from '../navigation/root-navigator';
import { useTabBarHeight, MINI_PLAYER_HEIGHT } from '../lib/layout';
import { useBlurTarget } from '../lib/blur-target';
import { GlassPanel } from './ui/glass-panel';
import { Cover } from './ui/cover';
import { Icon } from '../lib/icon';
import { colors } from '../lib/theme';
import { type } from '../lib/design/typography';
import { space, layout, radii } from '../lib/design/scales';

/**
 * Мини-плеер — самая заметная стеклянная поверхность продукта и единственное, что связывает
 * играющее с любым экраном. Живёт на общем материале (`GlassPanel`), а не на отдельной
 * системе стекла.
 *
 * Прогресс — нижняя линия по кромке, а не отдельная полоска: кит требует показывать его
 * rim'ом, и это же экономит высоту, которой у мини-плеера нет.
 */
export function MiniPlayer() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const track = usePlayerStore((s) => s.queue[s.queueIndex]);
  const status = usePlayerStore((s) => s.status);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const durationSec = usePlayerStore((s) => s.durationSec);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const tabBarHeight = useTabBarHeight();
  const blurTarget = useBlurTarget();

  // Жесты кита: свайп вверх — фуллскрин, вбок — переключение трека, тап — фуллскрин.
  // Переключать музыку, не открывая плеер, — главный выигрыш мини-плеера на телефоне.
  const gesture = useMemo(() => {
    const open = () => navigation.navigate('Player');
    const swipe = Gesture.Pan()
      .runOnJS(true)
      .minDistance(SWIPE_MIN)
      .onEnd((e) => {
        const horizontal = Math.abs(e.translationX) > Math.abs(e.translationY);
        if (!horizontal) {
          if (e.translationY < -SWIPE_MIN) open();
          return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (e.translationX < 0) next();
        else prev();
      });
    // runOnJS обязателен и здесь: без него `open()` зовётся синхронно с UI-рантайма и
    // ворклет падает («Tried to synchronously call a Remote Function»). Та же грабля
    // RNGH 2.32 + reanimated 4, что описана в components/liquid-glass.tsx.
    const tap = Gesture.Tap().runOnJS(true).maxDistance(SWIPE_MIN).onEnd(() => open());
    return Gesture.Exclusive(swipe, tap);
  }, [navigation, next, prev]);

  if (!track) return null;

  const progress = durationSec > 0 ? Math.min(1, Math.max(0, positionSec / durationSec)) : 0;
  const playing = status === 'playing';

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.wrap, { bottom: tabBarHeight + 10 }]}
        accessibilityRole="button"
        accessibilityLabel={`${track.title}, ${track.artistName}. Открыть плеер`}
      >
      <GlassPanel radius={radii.glass} blurTarget={blurTarget} style={styles.panel} contentStyle={styles.content}>
        <Cover uri={track.coverUrl} size={40} radius={radii.coverSm} />
        <View style={styles.info}>
          <Text style={type.row} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            {track.artistName}
          </Text>
        </View>
        <Pressable
          style={styles.playButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Пауза' : 'Играть'}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            togglePlayPause();
          }}
        >
          {status === 'loading' ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : (
            <Icon name={playing ? 'pause' : 'play'} size={20} color={colors.foreground} />
          )}
        </Pressable>
      </GlassPanel>
        <View style={styles.rimTrack} pointerEvents="none">
          <View style={[styles.rimFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </GestureDetector>
  );
}

/** Порог жеста: ниже него это дрожание пальца, а не свайп. */
const SWIPE_MIN = 24;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, height: MINI_PLAYER_HEIGHT },
  panel: { flex: 1 },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
  },
  info: { flex: 1, gap: 2, minWidth: 0 },
  playButton: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Кромка прогресса: не поверх контента, а по нижнему краю панели — читается как
  // подсветка стекла снизу, а не как виджет.
  rimTrack: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  rimFill: { height: 1, backgroundColor: 'rgba(255,255,255,0.55)' },
});

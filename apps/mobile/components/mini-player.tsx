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
import { PRODUCT_DIM } from '../lib/vireglass/material';

/**
 * Мини-плеер — самая заметная стеклянная поверхность продукта и единственное, что связывает
 * играющее с любым экраном. Живёт на общем материале (`GlassPanel`), а не на отдельной
 * системе стекла.
 *
 * Геометрия концентрическая: обложка отступает от верхнего, левого и нижнего края панели
 * на один и тот же INSET, а её радиус равен радиусу панели минус этот отступ. Иначе два
 * скругления в одном объекте читаются как две несогласованные детали.
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
        <GlassPanel
          radius={PANEL_RADIUS}
          blurTarget={blurTarget}
          dim={PRODUCT_DIM}
          style={styles.panel}
          contentStyle={styles.content}
        >
          <Cover uri={track.coverUrl} size={COVER} radius={PANEL_RADIUS - INSET} />
          <View style={styles.info}>
            <Text style={type.sectionTitle} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={type.caption} numberOfLines={1}>
              {track.artistName}
            </Text>
          </View>
          <Pressable
            style={styles.playButton}
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
        {/* Прогресс — информация, не контроллер: он внутри панели, начинается по левому
            краю текстовой колонки и не доходит до обложки. По кромке панели он читался
            как обрезанный скраббер и провоцировал тянуть его пальцем. Живёт снаружи
            GlassPanel: у той на контенте свой паддинг, от которого absolute отсчитывался
            бы дважды. */}
        <View style={styles.progressTrack} pointerEvents="none">
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </GestureDetector>
  );
}

/** Порог жеста: ниже него это дрожание пальца, а не свайп. */
const SWIPE_MIN = 24;

/** Отступ содержимого от края панели — он же зазор концентрии. */
const INSET = 8;
const PANEL_RADIUS = radii.glass;
const COVER = MINI_PLAYER_HEIGHT - INSET * 2;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, height: MINI_PLAYER_HEIGHT },
  panel: { flex: 1 },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: INSET,
  },
  info: { flex: 1, gap: 2, minWidth: 0 },
  playButton: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: INSET + COVER + space.md,
    right: INSET,
    bottom: INSET,
    height: 1.5,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: 1.5, borderRadius: radii.full, backgroundColor: colors.foreground, opacity: 0.7 },
});

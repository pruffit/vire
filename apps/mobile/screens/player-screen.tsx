import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/backdrop';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { nextQueueIndex } from '@vire/core/playback/queue';
import { usePlayerStore } from '../lib/player-store';
import { useLikesStore } from '../lib/likes-store';
import { usePreferences, useReduceMotion } from '../lib/design/preferences';
import { BlurTargetScope } from '../lib/blur-target';
import { WEB_BASE_URL } from '../lib/env';
import { formatDuration } from '../lib/format';
import { colors } from '../lib/theme';
import { type } from '../lib/design/typography';
import { space, layout, radii, motionDuration } from '../lib/design/scales';
import { PLAYER_TRANSPORT_HEIGHT } from '../lib/layout';
import { Icon } from '../lib/icon';
import { AmbientBackground } from '../components/player/ambient-background';
import { CoverCarousel } from '../components/player/cover-carousel';
import { SectionDivider } from '../components/player/section-divider';
import { Transport } from '../components/player/transport';
import { Waveform } from '../components/player/waveform';
import { QueueSection, LyricsSection, TrackSection } from '../components/player/panels';
import { TrackActionSheet } from '../components/player/track-action-sheet';
import type { RootStackParamList } from '../navigation/root-navigator';

/**
 * Фуллскрин-плеер: одна прокручиваемая поверхность с плавающим стеклянным транспортом.
 *
 * Транспорт — сиблинг `Backdrop`, а не потомок: цель преломления не может быть
 * предком стекла (`lib/blur-target.tsx`), иначе рекурсия RenderNode роняет RenderThread.
 */
export default function PlayerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const status = usePlayerStore((s) => s.status);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const durationSec = usePlayerStore((s) => s.durationSec);
  const waveformPeaks = usePlayerStore((s) => s.waveformPeaks);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const context = usePlayerStore((s) => s.context);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const likeTrack = useLikesStore((s) => s.like);

  const artRef = useRef<View>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [coverCenterY, setCoverCenterY] = useState(0);
  const [immersiveOn, setImmersiveOn] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const immersive = useSharedValue(0);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - immersive.value }));

  // Плеер перекрывает таб-бар и мини-плеер целиком: их стеклу под ним преломлять нечего,
  // а бюджет поверхностей иначе выходит за измеренную зелёную зону.
  const pushSheet = usePreferences((s) => s.pushSheet);
  const popSheet = usePreferences((s) => s.popSheet);
  useEffect(() => {
    pushSheet();
    return popSheet;
  }, [pushSheet, popSheet]);

  const track = queue[queueIndex];
  if (!track) return null;

  const hasNext = nextQueueIndex(queueIndex, queue.length, repeat) !== null;
  const hasPrev = queueIndex > 0;
  const playing = status === 'playing';
  // Высота — такое же ограничение, как ширина: первый экран фиксирован во вьюпорт, и на
  // невысоком аппарате обложка в 360 dp вытеснила бы заголовок с волной под обрез.
  const artSize = Math.min(width - space.xl * 2, 360, (viewportHeight || windowHeight) * ART_MAX_VIEWPORT);
  const edgeScale = Math.max(width, windowHeight) / artSize;
  // Обложка стоит выше центра экрана; без сдвига увеличенная в иммерсиве не достаёт до
  // нижней кромки. Считается от фактического layout, а не от предположений о раскладке.
  const immersiveShiftY = coverCenterY > 0 ? (viewportHeight || windowHeight) / 2 - coverCenterY : 0;
  const releaseId = context?.source === 'release' ? (context.sourceId ?? null) : null;

  const tap = (fn: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fn();
  };

  const toggleImmersive = () => {
    const on = !immersiveOn;
    setImmersiveOn(on);
    immersive.value = withTiming(on ? 1 : 0, { duration: motionDuration('screen', reduceMotion) });
  };

  const share = () => {
    Share.share({ message: `${track.title} — ${track.artistName}`, url: `${WEB_BASE_URL}/` }).catch(() => {});
  };

  const chromePointerEvents = immersiveOn ? 'none' : 'auto';

  return (
    <View style={styles.root}>
      <Backdrop
        targetRef={artRef}
        style={styles.blurTarget}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      >
        <BlurTargetScope target={artRef}>
          <Animated.ScrollView
            scrollEnabled={!immersiveOn}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: insets.bottom + space.md + PLAYER_TRANSPORT_HEIGHT + space.xl,
            }}
          >
            <View style={[styles.screen1, { height: viewportHeight || windowHeight }]}>
              <AmbientBackground coverUrl={track.coverUrl} />

              {/* Транспорт плавает над экраном 1 — место под него обязано быть вычтено
                  здесь, иначе заголовок и волна оказываются под капсулой и под системной
                  навигацией. */}
              <View
                style={[
                  styles.screen1Content,
                  {
                    paddingTop: insets.top + space.sm,
                    paddingBottom: insets.bottom + PLAYER_TRANSPORT_HEIGHT + space.md * 2,
                  },
                ]}
              >
                <Animated.View style={chromeStyle} pointerEvents={chromePointerEvents}>
                  <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.handleWrap}
                    accessibilityRole="button"
                    accessibilityLabel="Свернуть плеер"
                  >
                    <View style={styles.handle} />
                  </Pressable>
                </Animated.View>

                <View
                  style={styles.coverArea}
                  onLayout={(e) => {
                    const { y, height } = e.nativeEvent.layout;
                    setCoverCenterY(y + height / 2);
                  }}
                >
                  <CoverCarousel
                    queue={queue}
                    queueIndex={queueIndex}
                    size={artSize}
                    radius={radii.card}
                    immersive={immersive}
                    edgeScale={edgeScale}
                    immersiveShiftY={immersiveShiftY}
                    reduceMotion={reduceMotion}
                    onTap={toggleImmersive}
                    onDoubleTap={() => likeTrack(track.id)}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      setActionSheetOpen(true);
                    }}
                    onSwipeNext={next}
                    onSwipePrev={prev}
                    onDismiss={() => navigation.goBack()}
                  />
                </View>

                <Animated.View style={[styles.titles, chromeStyle]} pointerEvents={chromePointerEvents}>
                  <Text style={type.screenTitle} numberOfLines={2}>
                    {track.title}
                  </Text>
                  <Text style={type.subtitle} numberOfLines={1}>
                    {track.artistName}
                  </Text>
                </Animated.View>

                <Animated.View style={[styles.scrubber, chromeStyle]} pointerEvents={chromePointerEvents}>
                  <Waveform peaks={waveformPeaks} positionSec={positionSec} durationSec={durationSec} onSeek={seek} />
                  {/* Таймкоды прижаты к концам волны, которую они описывают; режимы
                      воспроизведения — нейтральной парой посередине. */}
                  <View style={styles.timesRow}>
                    <Text style={type.mono}>{formatDuration(positionSec)}</Text>
                    <View style={styles.modes}>
                      <Pressable
                        onPress={tap(toggleShuffle)}
                        style={styles.modeButton}
                        accessibilityRole="button"
                        accessibilityState={{ selected: shuffle }}
                        accessibilityLabel="Перемешать"
                      >
                        <Icon name="shuffle" size={18} color={shuffle ? colors.foreground : colors.mutedForeground} />
                      </Pressable>
                      <Pressable
                        onPress={tap(cycleRepeat)}
                        style={styles.modeButton}
                        accessibilityRole="button"
                        accessibilityState={{ selected: repeat !== 'off' }}
                        accessibilityLabel={repeat === 'one' ? 'Повтор одного трека' : 'Повтор'}
                      >
                        <View style={styles.modeIcon}>
                          <Icon
                            name="repeat"
                            size={18}
                            color={repeat !== 'off' ? colors.foreground : colors.mutedForeground}
                          />
                          {repeat === 'one' && <View style={styles.repeatDot} />}
                        </View>
                      </Pressable>
                    </View>
                    <Text style={type.mono}>{formatDuration(durationSec)}</Text>
                  </View>
                </Animated.View>

                {status === 'error' && <Text style={styles.error}>Не удалось воспроизвести — нажмите play ещё раз</Text>}
              </View>
            </View>

            <View style={styles.body}>
              <SectionDivider label="Текст" />
              <LyricsSection trackId={track.id} />

              <SectionDivider label="Трек" />
              <TrackSection />

              <SectionDivider label="Дальше" />
              <QueueSection />
            </View>
          </Animated.ScrollView>
        </BlurTargetScope>
      </Backdrop>

      <Animated.View
        style={[styles.transportWrap, { bottom: insets.bottom + space.lg }, chromeStyle]}
        pointerEvents={chromePointerEvents}
      >
        <Transport
          trackId={track.id}
          playing={playing}
          loading={status === 'loading'}
          hasNext={hasNext}
          hasPrev={hasPrev}
          blurTarget={artRef}
          onPrev={prev}
          onNext={next}
          onTogglePlay={togglePlayPause}
          onShare={share}
        />
      </Animated.View>

      <TrackActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        trackId={track.id}
        title={track.title}
        artistName={track.artistName}
        releaseId={releaseId}
      />
    </View>
  );
}

/** Доля высоты первого экрана, которую может занять обложка. */
const ART_MAX_VIEWPORT = 0.46;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  blurTarget: { flex: 1 },
  screen1: { overflow: 'hidden' },
  screen1Content: { flex: 1, paddingHorizontal: layout.screenPadding },
  handleWrap: { alignItems: 'center', minHeight: layout.touchTarget, justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: radii.full, backgroundColor: colors.border },
  coverArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titles: { gap: 4, paddingBottom: space.lg },
  scrubber: { gap: space.sm },
  timesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modes: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  modeButton: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIcon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  repeatDot: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 5,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.foreground,
  },
  error: { ...type.caption, color: colors.destructive, paddingTop: space.sm },
  body: { paddingHorizontal: layout.screenPadding },
  transportWrap: {
    position: 'absolute',
    left: layout.screenPadding,
    right: layout.screenPadding,
  },
});

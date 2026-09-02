import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { nextQueueIndex } from '@vire/core/playback/queue';
import type { PlaySource } from '@vire/api-contracts';
import { Backdrop } from '../components/backdrop';
import { usePlayerStore } from '../lib/player-store';
import { useLikesStore } from '../lib/likes-store';
import { usePreferences, useReduceMotion } from '../lib/design/preferences';
import { BlurTargetScope } from '../lib/blur-target';
import { WEB_BASE_URL } from '../lib/env';
import { formatDuration } from '../lib/format';
import { activeLineIndex, useLyrics } from '../lib/playback/use-lyrics';
import { colors } from '../lib/theme';
import { type } from '../lib/design/typography';
import { space, layout, radii, motionDuration } from '../lib/design/scales';
import { Icon } from '../lib/icon';
import { AmbientBackground } from '../components/player/ambient-background';
import { CoverCarousel } from '../components/player/cover-carousel';
import { LyricsGlass } from '../components/player/lyrics-glass';
import { Transport } from '../components/player/transport';
import { Waveform } from '../components/player/waveform';
import { QueueSection } from '../components/player/panels';
import { TrackActionSheet } from '../components/player/track-action-sheet';
import { ContextSections, ContextAction } from '../components/player/context-sections';
import { AddToPlaylistSheet } from '../components/add-to-playlist-sheet';
import { LikeButton } from '../components/like-button';
import type { RootStackParamList } from '../navigation/root-navigator';

/** Обложка дышит уже полей экрана: она главный носитель смысла, поля важнее для текста. */
const COVER_INSET = 12;
/** Высота ряда шапки под системным инсетом. */
const HEADER_HEIGHT = 44;
const HEADER_SCRIM = ["rgba(3,2,1,0.62)", "rgba(3,2,1,0)"] as const;

/** Доля обложки, которую занимает свёрнутая полоса текста. */
const LYRICS_BAND = 0.42;
const LYRICS_INSET = 10;
/** За сколько прокрутки полоса текста успевает раствориться. */
const LYRICS_FADE = 150;
/** Дальше этого полоса не ловит касания — иначе она перехватывала бы прокрутку страницы. */
const LYRICS_IDLE_AT = 20;

const SOURCE_LABEL: Record<PlaySource, string> = {
  wave: 'ВОЛНА',
  release: 'РЕЛИЗ',
  playlist: 'ПЛЕЙЛИСТ',
  artist: 'АРТИСТ',
  home: 'ГЛАВНАЯ',
  feed: 'ЛЕНТА',
  search: 'ПОИСК',
  liked: 'ЛЮБИМОЕ',
  purchased: 'ПОКУПКИ',
  direct: 'ОЧЕРЕДЬ',
};

/**
 * Фуллскрин-плеер: обложка во весь первый экран, контекст трека — прокруткой под ним.
 *
 * Стекло на экране ровно одно — полоса текста, лежащая НА обложке. Это единственное место,
 * где под материалом есть что преломлять; на затемнённом ambient-фоне он выглядел бы
 * выключенным, поэтому управление плоское.
 *
 * Полоса — сиблинг `Backdrop`, а не потомок: цель преломления не может быть предком стекла
 * (`lib/blur-target.tsx`), иначе рекурсия RenderNode роняет RenderThread. Поэтому она
 * стоит по замеренной рамке обложки и едет за прокруткой трансформом, а не лежит в потоке.
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

  const track = queue[queueIndex];
  const { lines } = useLyrics(track?.id);

  const artRef = useRef<View>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [viewportHeight, setViewportHeight] = useState(0);
  const [coverArea, setCoverArea] = useState<{ y: number; width: number; height: number } | null>(null);
  const [immersiveOn, setImmersiveOn] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyricsIdle, setLyricsIdle] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const immersive = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - immersive.value }));
  // Полоса текста живёт вне прокрутки и обязана ехать за обложкой сама; растворяется
  // задолго до конца первого экрана — ниже она уже не про обложку, а про чужой контент.
  const lyricsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -scrollY.value }],
    opacity: (1 - immersive.value) * Math.max(0, 1 - scrollY.value / LYRICS_FADE),
  }));

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  useAnimatedReaction(
    () => scrollY.value > LYRICS_IDLE_AT,
    (idle, previous) => {
      if (idle !== previous) runOnJS(setLyricsIdle)(idle);
    },
  );

  // Плеер перекрывает таб-бар и мини-плеер целиком: их стеклу под ним преломлять нечего,
  // а бюджет поверхностей иначе выходит за измеренную зелёную зону.
  const pushSheet = usePreferences((s) => s.pushSheet);
  const popSheet = usePreferences((s) => s.popSheet);
  useEffect(() => {
    pushSheet();
    return popSheet;
  }, [pushSheet, popSheet]);

  // Развёрнутый текст закрывает обложку целиком — держать его открытым, уехав к контексту,
  // незачем: он там всё равно растворён.
  useEffect(() => {
    if (lyricsIdle) setLyricsOpen(false);
  }, [lyricsIdle]);

  if (!track) return null;

  const hasNext = nextQueueIndex(queueIndex, queue.length, repeat) !== null;
  const hasPrev = queueIndex > 0;
  const heroHeight = viewportHeight || windowHeight;
  // Обложка занимает всё, что осталось после хрома, — по меньшей из сторон площадки.
  // Доля экрана сюда не годится: на низком аппарате она вытесняет волну под обрез, на
  // высоком оставляет пустоту в half-экрана.
  const artSize = Math.max(
    1,
    coverArea
      ? Math.floor(Math.min(coverArea.width, coverArea.height))
      : Math.min(width - layout.screenPadding * 2, heroHeight * 0.45),
  );
  const coverBox = coverArea ? { top: coverArea.y + (coverArea.height - artSize) / 2, size: artSize } : null;
  const edgeScale = Math.max(width, windowHeight) / artSize;
  const immersiveShiftY = coverBox ? heroHeight / 2 - (coverBox.top + coverBox.size / 2) : 0;
  const releaseId = context?.source === 'release' ? (context.sourceId ?? null) : null;
  const activeLine = activeLineIndex(lines, positionSec);
  const chromePointerEvents = immersiveOn ? 'none' : 'auto';

  const toggleImmersive = () => {
    const on = !immersiveOn;
    setImmersiveOn(on);
    immersive.value = withTiming(on ? 1 : 0, { duration: motionDuration('screen', reduceMotion) });
  };

  const share = () => {
    Share.share({ message: `${track.title} — ${track.artistName}`, url: `${WEB_BASE_URL}/` }).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <Backdrop
        targetRef={artRef}
        style={styles.blurTarget}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      >
        <BlurTargetScope target={artRef}>
          {/* Один контейнер на весь экран: ExpoView бэкдропа раскладывает только первого
              ребёнка, и вторым сиблингом прокрутка получала нулевую высоту. */}
          <View style={styles.screen}>
          <AmbientBackground coverUrl={track.coverUrl} />

          <Animated.ScrollView
            ref={scrollRef}
            style={styles.scroll}
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.hero,
                {
                  height: heroHeight,
                  paddingTop: insets.top + HEADER_HEIGHT,
                  paddingBottom: insets.bottom + space.md,
                },
              ]}
            >
              <View
                style={styles.coverArea}
                onLayout={(e) => {
                  const { y, width: w, height } = e.nativeEvent.layout;
                  setCoverArea((prev) =>
                    prev && prev.y === y && prev.width === w && prev.height === height
                      ? prev
                      : { y, width: w, height },
                  );
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

              <Animated.View style={[styles.controls, chromeStyle]} pointerEvents={chromePointerEvents}>
                <View style={styles.titleRow}>
                  <View style={styles.titles}>
                    <Text style={type.screenTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={type.subtitle} numberOfLines={1}>
                      {track.artistName}
                    </Text>
                  </View>
                  <LikeButton trackId={track.id} variant="primary" />
                  <Pressable
                    onPress={share}
                    hitSlop={8}
                    style={styles.titleAction}
                    accessibilityRole="button"
                    accessibilityLabel="Поделиться"
                  >
                    <Icon name="share" size={20} color={colors.foreground} />
                  </Pressable>
                </View>

                <Transport
                  playing={status === 'playing'}
                  loading={status === 'loading'}
                  hasNext={hasNext}
                  hasPrev={hasPrev}
                  shuffle={shuffle}
                  repeat={repeat}
                  onPrev={prev}
                  onNext={next}
                  onTogglePlay={togglePlayPause}
                  onToggleShuffle={toggleShuffle}
                  onCycleRepeat={cycleRepeat}
                />

                <View style={styles.scrubber}>
                  <Waveform peaks={waveformPeaks} positionSec={positionSec} durationSec={durationSec} onSeek={seek} />
                  <View style={styles.timesRow}>
                    <Text style={type.mono}>{formatDuration(positionSec)}</Text>
                    <Text style={type.mono}>{formatDuration(durationSec)}</Text>
                  </View>
                </View>

                {status === 'error' && (
                  <Text style={styles.error}>Не удалось воспроизвести — нажмите play ещё раз</Text>
                )}

                <Pressable
                  onPress={() => scrollRef.current?.scrollTo({ y: heroHeight, animated: true })}
                  style={styles.more}
                  accessibilityRole="button"
                  accessibilityLabel="Показать больше о треке"
                >
                  <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
                </Pressable>
              </Animated.View>
            </View>

            <View style={[styles.context, { paddingBottom: insets.bottom + space.xl }]}>
              <ContextSections trackId={track.id} />
              <View style={styles.section}>
                <Text style={type.mono}>ДАЛЬШЕ</Text>
                <QueueSection />
              </View>
              <View style={styles.section}>
                <ContextAction icon="plus" label="В плейлист" onPress={() => setPlaylistOpen(true)} />
                <ContextAction icon="share" label="Поделиться" onPress={share} />
              </View>
            </View>
          </Animated.ScrollView>

          {/* Шапка закреплена: свернуть плеер нужно и с прокрученного контекста, а заодно
              скрим держит читаемым системный статус-бар над уехавшей вверх обложкой. */}
          <Animated.View
            style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_HEIGHT }, chromeStyle]}
            pointerEvents={chromePointerEvents}
          >
            <LinearGradient colors={HEADER_SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Свернуть плеер"
            >
              <Icon name="chevron-down" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={type.mono} numberOfLines={1}>
              {context ? SOURCE_LABEL[context.source] : SOURCE_LABEL.direct}
            </Text>
            <View style={styles.headerButton} />
          </Animated.View>
          </View>
        </BlurTargetScope>
      </Backdrop>

      {lines && coverBox && (
        <Animated.View
          style={[
            styles.lyricsWrap,
            {
              top: coverBox.top,
              left: (width - coverBox.size) / 2,
              width: coverBox.size,
              height: coverBox.size,
            },
            lyricsStyle,
          ]}
          pointerEvents={lyricsIdle || immersiveOn ? 'none' : 'box-none'}
        >
          <View
            style={[
              styles.lyricsBand,
              lyricsOpen ? { top: LYRICS_INSET } : { height: Math.round(coverBox.size * LYRICS_BAND) },
            ]}
            pointerEvents={lyricsOpen ? 'auto' : 'box-none'}
          >
            <LyricsGlass
              key={track.id}
              lines={lines}
              activeIndex={activeLine}
              expanded={lyricsOpen}
              onToggle={() => setLyricsOpen((v) => !v)}
              onSeek={seek}
              blurTarget={artRef}
            />
          </View>
        </Animated.View>
      )}

      <AddToPlaylistSheet trackId={track.id} open={playlistOpen} onOpenChange={setPlaylistOpen} hideTrigger />

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  blurTarget: { flex: 1 },
  screen: { flex: 1, overflow: 'hidden' },
  scroll: { flex: 1 },
  hero: { paddingHorizontal: layout.screenPadding },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  coverArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -(layout.screenPadding - COVER_INSET),
  },
  controls: { gap: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titles: { flex: 1, gap: 2, minWidth: 0 },
  titleAction: { width: layout.touchTarget, height: layout.touchTarget, alignItems: 'center', justifyContent: 'center' },
  scrubber: { gap: space.xs },
  timesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { ...type.caption, color: colors.destructive },
  more: { alignItems: 'center', opacity: 0.85 },
  context: { paddingHorizontal: layout.screenPadding, paddingTop: space.lg, gap: space.xl },
  section: { gap: space.sm },
  lyricsWrap: { position: 'absolute' },
  lyricsBand: { position: 'absolute', left: LYRICS_INSET, right: LYRICS_INSET, bottom: LYRICS_INSET },
});

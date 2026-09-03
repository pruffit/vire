import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedReaction,
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
import { activeLineIndex, useLyrics } from '../lib/playback/use-lyrics';
import { useTrackContext } from '../lib/playback/use-track-context';
import { fetchWaveTracks } from '../lib/playback/wave';
import { resolveAccent } from '../lib/design/accent';
import { colors } from '../lib/theme';
import { type } from '../lib/design/typography';
import { space, layout, radii, motionDuration } from '../lib/design/scales';
import { Icon } from '../lib/icon';
import { PlayerGround } from '../components/player/player-ground';
import { CoverCarousel } from '../components/player/cover-carousel';
import { LyricsGlass } from '../components/player/lyrics-glass';
import { Transport } from '../components/player/transport';
import { ProgressLine } from '../components/player/progress-line';
import { QueueSection } from '../components/player/panels';
import { TrackActionSheet } from '../components/player/track-action-sheet';
import {
  ArtistCard,
  PlayerActions,
  SimilarArtists,
  WaveBanner,
} from '../components/player/player-context';
import { AddToPlaylistSheet } from '../components/add-to-playlist-sheet';
import { LikeButton } from '../components/like-button';
import type { RootStackParamList } from '../navigation/root-navigator';

/** Обложка дышит уже полей экрана: она главный носитель смысла. */
const COVER_INSET = 12;
/** Доля высоты вьюпорта — ПОТОЛОК обложки, а не её цель: на низком аппарате квадрат во всю
 *  ширину вытеснил бы управление за сгиб. */
const COVER_MAX_VIEWPORT = 0.46;
const HEADER_HEIGHT = 44;
const HEADER_SCRIM = ['rgba(3,2,1,0.62)', 'rgba(3,2,1,0)'] as const;
/** За сколько прокрутки шапка доходит до плотной: заголовок трека уезжает ровно под неё.
 *  Градиента для этого мало — фон экрана берёт цвет обложки и бывает светлым. */
const HEADER_SOLID_AT = 90;

/** За сколько прокрутки полоса текста успевает раствориться. */
const LYRICS_FADE = 150;
/** Дальше этого полоса не ловит касания — иначе она перехватывала бы прокрутку страницы. */
const LYRICS_IDLE_AT = 20;

/** Ближе этого к концу очереди волна подливает следующую пачку. */
const WAVE_REFILL_AT = 2;

const SOURCE_LABEL: Record<PlaySource, string> = {
  wave: 'Волна',
  release: 'Релиз',
  playlist: 'Плейлист',
  artist: 'Артист',
  home: 'Главная',
  feed: 'Лента',
  search: 'Поиск',
  liked: 'Любимое',
  purchased: 'Покупки',
  direct: 'Очередь',
};

/**
 * Фуллскрин-плеер.
 *
 * Раскладка выведена из того, что на экране делают, а не из симметрии: содержимое (обложка
 * и текст на ней) наверху — туда смотрят; частое управление внизу — там живёт большой палец;
 * контекст (волна, автор, похожие, очередь) под сгибом — это отдельное намерение.
 * Разбор — `docs/superpowers/specs/2026-09-03-mobile-player-v3.md`.
 *
 * Первый экран НЕ растянут на вьюпорт: блоки идут подряд, остаток высоты занимает начало
 * контекста. Растянутый центрировал обложку в остатке и оставлял пустоту вокруг неё.
 *
 * Стекло на экране одно — полоса текста на обложке, единственное место, где под материалом
 * есть что преломлять. Она сиблинг `Backdrop`, а не потомок: цель преломления не может быть
 * предком стекла (`lib/blur-target.tsx`), поэтому полоса стоит по замеренной рамке обложки
 * и едет за прокруткой трансформом.
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
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const context = usePlayerStore((s) => s.context);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const appendToQueue = usePlayerStore((s) => s.appendToQueue);
  const likeTrack = useLikesStore((s) => s.like);

  const track = queue[queueIndex];
  const { lines, synced } = useLyrics(track?.id);
  const trackContext = useTrackContext(track?.id);

  const artRef = useRef<View>(null);
  // Второй захват — только фон. Плашки лежат В прокрутке, то есть внутри artRef, и её
  // преломлять не могут (цель не может быть предком стекла). Фон им предком не приходится,
  // поэтому у них живой бэкдроп есть, а рекурсии RenderNode нет.
  const groundRef = useRef<View>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [coverTop, setCoverTop] = useState(0);
  const [immersiveOn, setImmersiveOn] = useState(false);
  const [lyricsShown, setLyricsShown] = useState(false);
  const [lyricsIdle, setLyricsIdle] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const immersive = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - immersive.value }));
  const headerSolidStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, scrollY.value / HEADER_SOLID_AT),
  }));
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

  // Плеер перекрывает таб-бар и мини-плеер целиком: их стеклу под ним преломлять нечего.
  const pushSheet = usePreferences((s) => s.pushSheet);
  const popSheet = usePreferences((s) => s.popSheet);
  useEffect(() => {
    pushSheet();
    return popSheet;
  }, [pushSheet, popSheet]);

  // Волна бесконечна по замыслу: доливаем хвост, не дожидаясь тишины.
  const waveSeed = queue[queue.length - 1]?.id;
  const tail = queue.length - 1 - queueIndex;
  const queueIds = queue.map((t) => t.id).join(',');
  useEffect(() => {
    if (context?.source !== 'wave' || !waveSeed || tail > WAVE_REFILL_AT) return;
    let cancelled = false;
    fetchWaveTracks(waveSeed, queueIds.split(',')).then((tracks) => {
      if (!cancelled) appendToQueue(tracks);
    });
    return () => {
      cancelled = true;
    };
  }, [context?.source, waveSeed, tail, queueIds, appendToQueue]);

  const openArtist = useCallback(
    (slug: string) => {
      navigation.navigate('Main', { screen: 'Home', params: { screen: 'ArtistDetail', params: { slug } } });
    },
    [navigation],
  );

  const accent = useMemo(() => resolveAccent(trackContext?.artist.accentColor), [trackContext]);

  if (!track) return null;

  const hasNext = nextQueueIndex(queueIndex, queue.length, repeat) !== null;
  const hasPrev = queueIndex > 0;
  const viewport = viewportHeight || windowHeight;
  const artSize = Math.max(1, Math.min(width - COVER_INSET * 2, viewport * COVER_MAX_VIEWPORT));
  const edgeScale = Math.max(width, windowHeight) / artSize;
  const coverScreenTop = coverTop + insets.top + HEADER_HEIGHT;
  const immersiveShiftY = viewport / 2 - (coverScreenTop + artSize / 2);
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

  const startWave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const tracks = await fetchWaveTracks(track.id, [track.id]);
    if (tracks.length > 0) await playQueue([track, ...tracks], 0, { source: 'wave' });
  };

  return (
    <View style={styles.root}>
      <Backdrop targetRef={groundRef} style={StyleSheet.absoluteFill}>
        <PlayerGround coverUrl={track.coverUrl} accent={accent} />
      </Backdrop>

      <Backdrop
        targetRef={artRef}
        style={styles.blurTarget}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      >
        <BlurTargetScope target={artRef}>
          {/* Один контейнер на весь экран: ExpoView бэкдропа раскладывает только первого
              ребёнка, и вторым сиблингом прокрутка получала нулевую высоту. */}
          <View style={styles.screen}>
            <Animated.ScrollView
              style={styles.scroll}
              onScroll={onScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: insets.top + HEADER_HEIGHT,
                paddingBottom: insets.bottom + space.xl,
              }}
            >
              <Animated.View style={[styles.hero, chromeStyle]} pointerEvents={chromePointerEvents}>
                <View
                  style={styles.coverArea}
                  onLayout={(e) => setCoverTop(e.nativeEvent.layout.y)}
                  pointerEvents="box-none"
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
                </View>

                <Transport
                  playing={status === 'playing'}
                  loading={status === 'loading'}
                  accent={accent}
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

                <ProgressLine
                  positionSec={positionSec}
                  durationSec={durationSec}
                  accent={accent.fill}
                  onSeek={seek}
                />

                <PlayerActions
                  hasLyrics={lines !== null}
                  lyricsShown={lyricsShown}
                  accent={accent}
                  blurTarget={groundRef}
                  onToggleLyrics={() => setLyricsShown((v) => !v)}
                  onPlaylist={() => setPlaylistOpen(true)}
                  onShare={share}
                />

                {status === 'error' && (
                  <Text style={styles.error}>Не удалось воспроизвести — нажмите play ещё раз</Text>
                )}
              </Animated.View>

              <View style={styles.context}>
                <WaveBanner trackTitle={track.title} accent={accent} blurTarget={groundRef} onPress={startWave} />

                {trackContext && (
                  <>
                    <ArtistCard
                      artist={trackContext.artist}
                      accent={accent}
                      onPress={() => openArtist(trackContext.artist.slug)}
                    />
                    <SimilarArtists items={trackContext.similar} onPress={openArtist} />
                  </>
                )}

                <QueueSection />
              </View>
            </Animated.ScrollView>

            {/* Шапка закреплена: свернуть плеер нужно и с прокрученного контекста, а скрим
                держит читаемым системный статус-бар над уехавшей вверх обложкой. */}
            <Animated.View
              style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_HEIGHT }, chromeStyle]}
              pointerEvents={chromePointerEvents}
            >
              <Animated.View style={[StyleSheet.absoluteFill, styles.headerSolid, headerSolidStyle]} pointerEvents="none" />
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
              <Text style={type.caption} numberOfLines={1}>
                {context ? SOURCE_LABEL[context.source] : SOURCE_LABEL.direct}
              </Text>
              <View style={styles.headerButton} />
            </Animated.View>
          </View>
        </BlurTargetScope>
      </Backdrop>

      {lines && lyricsShown && (
        <Animated.View
          style={[
            styles.lyricsWrap,
            { top: coverScreenTop, left: (width - artSize) / 2, width: artSize, height: artSize },
            lyricsStyle,
          ]}
          pointerEvents={lyricsIdle || immersiveOn ? 'none' : 'box-none'}
        >
          <LyricsGlass
            key={track.id}
            lines={lines}
            activeIndex={activeLine}
            synced={synced}
            onSeek={seek}
            blurTarget={artRef}
          />
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

  /** Внутри блока — шаг шкалы; расстояние между блоками задаёт `context`. */
  hero: { paddingHorizontal: layout.screenPadding, gap: space.lg },
  coverArea: { alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titles: { flex: 1, gap: 2, minWidth: 0 },
  titleAction: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...type.caption, color: colors.destructive },

  context: { paddingHorizontal: layout.screenPadding, paddingTop: space.xl, gap: space.xl },
  block: { gap: space.sm },

  headerSolid: { backgroundColor: colors.background },
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

  lyricsWrap: { position: 'absolute' },
});

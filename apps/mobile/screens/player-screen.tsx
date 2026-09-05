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
import { GlassPanel } from '../components/ui/glass-panel';
import { PlayerGround } from '../components/player/player-ground';
import { CoverCarousel } from '../components/player/cover-carousel';
import { LyricsGlass } from '../components/player/lyrics-glass';
import { Transport } from '../components/player/transport';
import { ProgressLine } from '../components/player/progress-line';
import { QueueSection } from '../components/player/panels';
import { TrackActionSheet } from '../components/player/track-action-sheet';
import { ArtistCard, SimilarArtists, WaveBanner } from '../components/player/player-context';
import { ShareSheet } from '../components/player/share-sheet';
import { LikeButton } from '../components/like-button';
import type { RootStackParamList } from '../navigation/root-navigator';

/** Обложка дышит уже полей экрана: она главный носитель смысла. */
const COVER_INSET = 12;
/** Доля высоты вьюпорта — ПОТОЛОК обложки, а не её цель: на низком аппарате квадрат во всю
 *  ширину вытеснил бы управление за сгиб. */
const COVER_MAX_VIEWPORT = 0.46;
const HEADER_HEIGHT = 44;

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
 * контекст (волна, автор, похожие, очередь) под сгибом — это отдельное намерение. Прогресс
 * стоит НАД транспортом (обе мировые модели держат его выше), ряд действий снят — редкое
 * («В плейлист», «Поделиться», «К релизу», «Открыть артиста») ушло в лист `⋯` шапки, частое
 * (лайк, текст, очередь) осталось на первом экране. Разбор —
 * `docs/superpowers/specs/2026-09-03-mobile-player-v4-brief.md`.
 *
 * Первый экран НЕ растянут на вьюпорт: блоки идут подряд, остаток высоты занимает начало
 * контекста. Растянутый центрировал обложку в остатке и оставлял пустоту вокруг неё.
 *
 * Поле обложки — два режима, обложка и текст, переключатель на самом поле (правый верхний
 * угол рамки). Обложка остаётся под панелью текста: стекло имеет смысл только там, где под
 * ним есть что преломлять. Панель — сиблинг `Backdrop`, а не потомок: цель преломления не
 * может быть предком стекла (`lib/blur-target.tsx`), поэтому она стоит по замеренной рамке
 * обложки и едет за прокруткой трансформом.
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
  const groundRef = useRef<View>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [coverTop, setCoverTop] = useState(0);
  const [immersiveOn, setImmersiveOn] = useState(false);
  const [lyricsShown, setLyricsShown] = useState(false);
  const [lyricsIdle, setLyricsIdle] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

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

  // Цвет берётся по значению, а не по объекту контекста: иначе сцена перекрашивалась бы
  // кросс-фейдом на каждое обновление контекста.
  const accentColor = track?.accentColor ?? trackContext?.artist.accentColor;
  const accent = useMemo(() => resolveAccent(accentColor), [accentColor]);

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
  const hasLyrics = lines !== null;

  const toggleImmersive = () => {
    const on = !immersiveOn;
    setImmersiveOn(on);
    immersive.value = withTiming(on ? 1 : 0, { duration: motionDuration('screen', reduceMotion) });
  };

  const share = () => setShareOpen(true);

  const startWave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const tracks = await fetchWaveTracks(track.id, [track.id]);
    if (tracks.length > 0) await playQueue([track, ...tracks], 0, { source: 'wave' });
  };

  return (
    <View style={styles.root}>
      {/* Захват сцены: плашки контекста лежат В прокрутке, то есть внутри artRef, и её
          преломлять не могут — цель не может быть предком стекла. */}
      <Backdrop targetRef={groundRef} style={StyleSheet.absoluteFill}>
        <PlayerGround
          accent={accent}
          width={width}
          height={windowHeight}
          haloCenterX={width / 2}
          haloCenterY={coverScreenTop + artSize / 2}
          artSize={artSize}
        />
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
              {/* Обложка НЕ под `chromeStyle`: иммерсив гасит интерфейс вокруг неё, а не её
                  саму — под общей прозрачностью она исчезала вместе с ним. */}
              <View style={styles.hero}>
                <View
                  style={styles.coverArea}
                  onLayout={(e) => setCoverTop(e.nativeEvent.layout.y)}
                  pointerEvents="box-none"
                >
                  <View style={{ width: artSize, height: artSize }}>
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
                    {/* На инструментале гаснет, а не пропадает — иначе угол поля прыгает
                        на каждой смене трека. */}
                    <Animated.View
                      style={[styles.lyricsToggleSlot, chromeStyle]}
                      pointerEvents={chromePointerEvents}
                    >
                      <Pressable
                        style={[
                          styles.lyricsToggle,
                          lyricsShown && { backgroundColor: accent.fill },
                          !hasLyrics && styles.lyricsToggleDisabled,
                        ]}
                        disabled={!hasLyrics}
                        onPress={() => setLyricsShown((v) => !v)}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !hasLyrics, selected: lyricsShown }}
                        accessibilityLabel="Текст песни"
                      >
                        <Icon name="text" size={20} color={lyricsShown ? accent.ink : colors.foreground} />
                      </Pressable>
                    </Animated.View>
                  </View>
                </View>

                <Animated.View style={[styles.heroChrome, chromeStyle]} pointerEvents={chromePointerEvents}>
                <View style={styles.titleRow}>
                  <View style={styles.titles}>
                    <Text style={type.screenTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    {/* Имя автора — переход, а не подпись: из плеера к артисту ведёт только
                        оно, и выглядеть оно обязано нажимаемым. */}
                    <Pressable
                      style={styles.artistLink}
                      disabled={!trackContext}
                      onPress={() => trackContext && openArtist(trackContext.artist.slug)}
                      accessibilityRole="link"
                      accessibilityLabel={`Открыть артиста ${track.artistName}`}
                    >
                      <Text style={styles.artistName} numberOfLines={1}>
                        {track.artistName}
                      </Text>
                      {trackContext && <Icon name="chevron-right" size={16} color={colors.foreground} />}
                    </Pressable>
                  </View>
                  <LikeButton trackId={track.id} variant="primary" />
                </View>

                <ProgressLine
                  positionSec={positionSec}
                  durationSec={durationSec}
                  accent={accent.fill}
                  onSeek={seek}
                />

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

                {status === 'error' && (
                  <Text style={styles.error}>Не удалось воспроизвести — нажмите play ещё раз</Text>
                )}
                </Animated.View>
              </View>

              <Animated.View style={[styles.context, chromeStyle]} pointerEvents={chromePointerEvents}>
                <WaveBanner trackTitle={track.title} blurTarget={groundRef} onPress={startWave} />

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
              </Animated.View>
            </Animated.ScrollView>

          </View>
        </BlurTargetScope>
      </Backdrop>

      {/* Шапка — сиблинг Backdrop, а не потомок: под ней едет обложка, и стеклу здесь есть
          что преломлять. Внутри захвата она преломляла бы саму себя (рекурсия RenderNode). */}
      <Animated.View
        style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_HEIGHT }, chromeStyle]}
        pointerEvents={chromePointerEvents}
      >
        <GlassPanel
          radius={0}
          blurTarget={artRef}
          topLayer
          adaptive={false}
          style={StyleSheet.absoluteFill}
          contentStyle={styles.headerGlass}
        >
          <View style={StyleSheet.absoluteFill} pointerEvents="none" />
        </GlassPanel>

        {/* Уплотнение — ПОВЕРХ линзы, а не внутри неё: линза рисуется над своими детьми, и
            подложка под ней ничего не давала — метка источника тонула в светлой обложке. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: accent.base }, headerSolidStyle]}
          pointerEvents="none"
        />

        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={{ height: insets.top }} pointerEvents="none" />
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Свернуть плеер"
            >
              <Icon name="chevron-down" size={24} color={colors.foreground} />
            </Pressable>
            <Text style={styles.source} numberOfLines={1}>
              {context ? SOURCE_LABEL[context.source] : SOURCE_LABEL.direct}
            </Text>
            <Pressable
              onPress={() => setActionSheetOpen(true)}
              hitSlop={10}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Действия с треком"
            >
              <Icon name="more-horizontal" size={24} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
      </Animated.View>

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

      <ShareSheet
        open={shareOpen}
        trackId={track.id}
        title={track.title}
        artistName={track.artistName}
        coverUrl={track.coverUrl}
        artistSlug={trackContext?.artist.slug ?? null}
        onClose={() => setShareOpen(false)}
        onOpenArtist={openArtist}
      />

      <TrackActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        trackId={track.id}
        title={track.title}
        releaseId={releaseId}
        artistSlug={trackContext?.artist.slug ?? null}
        hasLyrics={hasLyrics}
        onShowLyrics={() => setLyricsShown(true)}
        onShare={share}
        onOpenArtist={openArtist}
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
  heroChrome: { gap: space.lg },
  coverArea: { alignItems: 'center' },
  lyricsToggleSlot: { position: 'absolute', top: space.sm, right: space.sm },
  lyricsToggle: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,2,1,0.45)',
  },
  lyricsToggleDisabled: { opacity: 0.32 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  artistLink: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 28 },
  artistName: { ...type.subtitle, color: colors.foreground },
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


  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerGlass: { flex: 1 },
  headerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
  },
  /** Откуда играет — не метка, а строка: моно с разрядкой здесь читалось слабо. */
  source: { ...type.row, color: colors.mutedForeground },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  lyricsWrap: { position: 'absolute' },
});

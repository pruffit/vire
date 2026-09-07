import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { Backdrop } from '../components/backdrop';
import { usePlayerStore } from '../lib/player-store';
import { useLikesStore } from '../lib/likes-store';
import { usePreferences, useReduceMotion } from '../lib/design/preferences';
import { BlurTargetScope } from '../lib/blur-target';
import { activeLineIndex, useLyrics } from '../lib/playback/use-lyrics';
import { useTrackContext } from '../lib/playback/use-track-context';
import { fetchWaveTracks } from '../lib/playback/wave';
import { resolveAccent } from '../lib/design/accent';
import { colors } from '../lib/theme';
import { fonts, type } from '../lib/design/typography';
import { space, layout, motionDuration } from '../lib/design/scales';
import { Icon } from '../lib/icon';
import { HazeGround, HAZE_TOP } from '../components/haze-ground';
import { useMock } from '../lib/design/mock';
import { CoverCarousel } from '../components/player/cover-carousel';
import { LyricsGlass } from '../components/player/lyrics-glass';
import { Transport } from '../components/player/transport';
import { ProgressLine } from '../components/player/progress-line';
import { FlowButton } from '../components/player/flow-button';
import { QueueSection } from '../components/player/panels';
import { TrackActionSheet } from '../components/player/track-action-sheet';
import { ArtistCard, SimilarArtists } from '../components/player/player-context';
import { ShareSheet } from '../components/player/share-sheet';
import { LikeButton } from '../components/like-button';
import type { RootStackParamList } from '../navigation/root-navigator';

const MOCK_TOP_BAR_Y = 52;
const MOCK_TOP_ICON = 22;
const MOCK_TOP_STEP = 36;

/** За сколько прокрутки шапка доходит до плотной: заголовок трека уезжает ровно под неё.
 *  Градиента для этого мало — фон экрана берёт цвет обложки и бывает светлым. */
const HEADER_SOLID_AT = 90;

/** За сколько прокрутки полоса текста успевает раствориться. */
const LYRICS_FADE = 150;
/** Дальше этого полоса не ловит касания — иначе она перехватывала бы прокрутку страницы. */
const LYRICS_IDLE_AT = 20;

/** Ближе этого к концу очереди волна подливает следующую пачку. */
const WAVE_REFILL_AT = 2;

/** Отбивки первого экрана, считанные снизу вверх от кнопки «ПОТОК» — см. спеку
 *  `docs/superpowers/specs/2026-09-06-mobile-stand-design.md`. */
/** Обложка стоит на этой высоте от верха экрана — как в макете. */
const MOCK_COVER_TOP = 100;
const MOCK_COVER_RADIUS = 18;
/** Пол обложки: ниже него она перестаёт быть содержимым и становится миниатюрой. */
const MOCK_COVER_MIN = 132;
const MOCK_COVER_TO_TITLE = 36;
const MOCK_TITLE_TO_ARTIST = 24;
const MOCK_ARTIST_TO_PROGRESS = 24;
const MOCK_PROGRESS_TO_TRANSPORT = 42;
const MOCK_TRANSPORT_TO_FLOW = 38;
const MOCK_FLOW_BOTTOM = 44;
/** Полотно макета: высота и сторона обложки (300 − 2×20). Вертикаль считается по остатку
 *  `высота − обложка`, потому что обложку зажимает ширина поля, а не высота экрана. */
const MOCK_PHONE_HEIGHT = 640;
const MOCK_COVER_SIDE = 260;
const MOCK_ACTION = 25;
const MOCK_ACTION_STEP = 38;
const MOCK_TITLE_SIZE = 22;
/** Главный значок транспорта: по нему считается высота ряда, а от неё — отбивки. */
const MOCK_PLAY = 34;
const MOCK_ARTIST_SIZE = 15;
const MOCK_SCREEN_MARGIN = 20;

/**
 * Фуллскрин-плеер.
 *
 * Первый экран — колонка на всю высоту вьюпорта, раскладка считается СНИЗУ ВВЕРХ от кнопки
 * «ПОТОК»: она опора группы управления, прибитой к нижнему краю. Остаток высоты копится
 * ВОЗДУХОМ над обложкой — единственным местом, где экрану есть куда расти на высоком
 * аппарате. Контекст (автор, похожие, очередь) идёт ниже сгиба, в той же прокрутке.
 *
 * Поле обложки — два режима, обложка и текст, переключатель в шапке (см. заголовок). Обложка
 * остаётся под панелью текста: стекло имеет смысл только там, где под ним есть что
 * преломлять. Панель — сиблинг `Backdrop`, а не потомок: цель преломления не может быть
 * предком стекла (`lib/blur-target.tsx`), поэтому она стоит по замеренной рамке обложки и
 * едет за прокруткой трансформом.
 */
export default function PlayerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const ms = useMock();

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
  const [coverRegionHeight, setCoverRegionHeight] = useState(0);
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
  const contentWidth = width - ms(MOCK_SCREEN_MARGIN) * 2;
  // Сторону обложки задаёт ЗАМЕРЕННАЯ высота её поля, а не арифметика по вставкам: поле
  // растянуто `flex`, и остаток высоты за группой управления считает сам движок раскладки.
  // Считанная вручную стопка расходилась с настоящей на любой строке, появившейся в группе
  // (например на ошибке воспроизведения), и обложка прыгала прямо во время проигрывания.
  const topIcon = ms(MOCK_TOP_ICON);
  const topBarCenter = Math.max(insets.top + topIcon / 2 + 6, ms(MOCK_TOP_BAR_Y));
  const headerHeight = topBarCenter + topIcon / 2 + ms(8);
  // Вертикальные отбивки тянутся по ОСТАТКУ высоты за обложкой, а не по ширине. Обложка
  // упирается в ширину поля и высоту макета не добирает; если считать отбивки от ширины,
  // разница копится одной дырой. Здесь она раскладывается по всем отбивкам разом — стопка
  // садится в экран точно, и пустоты не остаётся ни сверху, ни под кнопкой.
  const vs = (v: number) =>
    (v * (viewport - contentWidth)) / (MOCK_PHONE_HEIGHT - MOCK_COVER_SIDE);
  const coverAir = Math.max(0, vs(MOCK_COVER_TOP) - headerHeight);
  const artSize = Math.min(contentWidth, Math.max(ms(MOCK_COVER_MIN), coverRegionHeight - coverAir));
  const edgeScale = Math.max(width, windowHeight) / artSize;
  const coverScreenTop = coverTop + headerHeight;
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

  // Отбивки макета заданы ОТ БАЗОВОЙ ЛИНИИ (и от центра ряда транспорта), а не как поля
  // между блоками. Переносить их полями нельзя: стопка выходит выше нарисованной ровно на
  // сумму строчных боксов и съедает обложку. Ниже они переведены в поля по метрикам строк.
  const titleSize = ms(MOCK_TITLE_SIZE);
  const artistSize = ms(MOCK_ARTIST_SIZE);
  const artistLine = Math.round(artistSize * 1.33);
  // Шаг между базовыми линиями подписи задаёт САМ строчный бокс названия.
  const titleStyle = { fontSize: titleSize, lineHeight: ms(MOCK_TITLE_TO_ARTIST) };
  const artistStyle = { fontSize: artistSize, lineHeight: artistLine };
  const ascent = (line: number, size: number) => Math.round((line + size * 0.72) / 2);
  const descent = (line: number, size: number) => line - ascent(line, size);
  const transportBox = ms(MOCK_PLAY);
  // Отбивка не уходит в минус: на низком экране (или при увеличенном системном кегле)
  // `vs()` мал, а вычитаемая метрика строки нет — блоки наезжали бы друг на друга.
  const gap = (v: number, metric: number) => Math.max(0, vs(v) - metric);
  const coverToTitle = gap(MOCK_COVER_TO_TITLE, ascent(ms(MOCK_TITLE_TO_ARTIST), titleSize));
  const artistToProgress = gap(MOCK_ARTIST_TO_PROGRESS, descent(artistLine, artistSize));
  const progressToTransport = gap(MOCK_PROGRESS_TO_TRANSPORT, transportBox / 2);
  const transportToFlow = gap(MOCK_TRANSPORT_TO_FLOW, transportBox / 2);

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
        <HazeGround accent={accent} width={width} height={windowHeight} />
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
              contentContainerStyle={styles.scrollContent}
            >
              {/* Первый экран занимает вьюпорт целиком, но МИНИМУМОМ, а не жёсткой высотой:
                  на низком аппарате группа управления обязана вытолкнуть экран в прокрутку,
                  а не сплющить обложку. */}
              <View
                style={[
                  { paddingHorizontal: ms(MOCK_SCREEN_MARGIN) },
                  {
                    minHeight: viewport,
                    paddingTop: headerHeight,
                    paddingBottom: vs(MOCK_FLOW_BOTTOM),
                  },
                ]}
              >
                {/* Обложка НЕ под `chromeStyle`: иммерсив гасит интерфейс вокруг неё, а не её
                    саму — под общей прозрачностью она исчезала вместе с ним. */}
                {/* Базис — макетная высота области (воздух над обложкой плюс сама обложка),
                    дальше рост. Лишнюю высоту аппарата делит пополам с распоркой под кнопкой:
                    целиком сверху она читается провалом под панелью, целиком снизу — отрывает
                    «ПОТОК» от края. Потолок здесь стоять не может: упёршись в него, рост
                    прекращался и остаток ложился мёртвой полосой под кнопкой. */}
                <View
                  style={[styles.coverRegion, { flexBasis: coverAir + contentWidth }]}
                  onLayout={(e) => setCoverRegionHeight(e.nativeEvent.layout.height)}
                >
                  <View
                    style={{ width: artSize, height: artSize }}
                    onLayout={(e) => setCoverTop(e.nativeEvent.layout.y)}
                    pointerEvents="box-none"
                  >
                    <CoverCarousel
                      queue={queue}
                      queueIndex={queueIndex}
                      size={artSize}
                      radius={ms(MOCK_COVER_RADIUS)}
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
                </View>

                <Animated.View
                  style={[{ marginTop: coverToTitle }, chromeStyle]}
                  pointerEvents={chromePointerEvents}
                >
                  <View style={styles.titleRow}>
                    <View style={styles.titles}>
                      <Text style={[styles.title, titleStyle]} numberOfLines={1}>
                        {track.title}
                      </Text>
                      {/* Имя автора — переход, а не подпись: из плеера к артисту ведёт только
                          оно. */}
                      <Pressable
                        style={styles.artistLink}
                        hitSlop={12}
                        disabled={!trackContext}
                        onPress={() => trackContext && openArtist(trackContext.artist.slug)}
                        accessibilityRole="link"
                        accessibilityLabel={`Открыть артиста ${track.artistName}`}
                      >
                        <Text style={[styles.artist, artistStyle]} numberOfLines={1}>
                          {track.artistName}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={[styles.actions, { gap: ms(MOCK_ACTION_STEP) - ms(MOCK_ACTION) }]}>
                      <LikeButton trackId={track.id} variant="title" size={ms(MOCK_ACTION)} />
                      <Pressable
                        onPress={share}
                        hitSlop={14}
                        style={{ width: ms(MOCK_ACTION), height: ms(MOCK_ACTION), alignItems: 'center', justifyContent: 'center' }}
                        accessibilityRole="button"
                        accessibilityLabel="Поделиться треком"
                      >
                        <Icon name="share" size={ms(MOCK_ACTION)} color={colors.foreground} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ marginTop: artistToProgress }}>
                    <ProgressLine positionSec={positionSec} durationSec={durationSec} onSeek={seek} />
                  </View>

                  <View style={{ marginTop: progressToTransport }}>
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
                      width={contentWidth}
                    />
                  </View>

                  {status === 'error' && (
                    <Text style={styles.error}>Не удалось воспроизвести — нажмите play ещё раз</Text>
                  )}

                  <View style={{ marginTop: transportToFlow }}>
                    <FlowButton onPress={startWave} blurTarget={groundRef} width={contentWidth} />
                  </View>
                </Animated.View>

              </View>

              <Animated.View style={[styles.context, chromeStyle]} pointerEvents={chromePointerEvents}>
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

      {/* Верхняя панель — ПРОСТО ЗНАЧКИ на фоне, без стекла. Стеклянная панель, стоявшая
          здесь, давала жёсткую горизонтальную кромку поперёк экрана; в макете панели нет. */}
      <Animated.View
        style={[styles.header, { height: headerHeight }, chromeStyle]}
        pointerEvents={chromePointerEvents}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.headerSolid, headerSolidStyle]}
          pointerEvents="none"
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={{ height: topBarCenter - topIcon / 2 }} pointerEvents="none" />
          <View style={[styles.headerRow, { paddingHorizontal: ms(MOCK_SCREEN_MARGIN) }]}>
            <View style={[styles.headerSide, styles.headerSideStart]}>
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={13}
                style={[{ width: topIcon, height: topIcon, alignItems: 'center', justifyContent: 'center' }, styles.headerIconAlpha]}
                accessibilityRole="button"
                accessibilityLabel="Свернуть плеер"
              >
                <Icon name="chevron-down" size={topIcon} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.headerGap} />

            <View style={[styles.headerSide, styles.headerSideEnd, { gap: ms(MOCK_TOP_STEP) - topIcon }]}>
              <Pressable
                onPress={() => setLyricsShown((v) => !v)}
                disabled={!hasLyrics}
                hitSlop={13}
                style={{ width: topIcon, height: topIcon, alignItems: 'center', justifyContent: 'center', opacity: hasLyrics ? 0.72 : 0.3 }}
                accessibilityRole="button"
                accessibilityState={{ disabled: !hasLyrics, selected: lyricsShown }}
                accessibilityLabel="Текст песни"
              >
                <Icon name="align-center" size={topIcon} color={lyricsShown ? accent.ink : colors.foreground} />
              </Pressable>
              <Pressable
                onPress={() => setActionSheetOpen(true)}
                hitSlop={13}
                style={[{ width: topIcon, height: topIcon, alignItems: 'center', justifyContent: 'center' }, styles.headerIconAlpha]}
                accessibilityRole="button"
                accessibilityLabel="Действия с треком"
              >
                <Icon name="more-vertical" size={topIcon} color={colors.foreground} />
              </Pressable>
            </View>
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
  scrollContent: { paddingBottom: space.xl },

  coverRegion: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titles: { flex: 1, minWidth: 0 },
  /** Подпись трека набрана ИНТЕРФЕЙСНЫМ гротеском: витринное начертание на этом экране
   *  занято кнопкой «ПОТОК», и второй раз оно спорило бы с ней за роль. */
  title: { fontFamily: fonts.semibold, color: '#f2f4f8' },
  artist: { fontFamily: fonts.regular, color: '#98a1b2' },
  /** Имя автора — переход: тач-зону ему добирает `hitSlop`, а `minHeight` держит её
   *  предсказуемой при любой длине имени. */
  artistLink: { alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', opacity: 0.62 },
  error: { ...type.caption, color: colors.destructive, marginTop: space.sm },


  context: { paddingHorizontal: layout.screenPadding, paddingTop: space.xl, gap: space.xl },

  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerSolid: { backgroundColor: HAZE_TOP },
  headerRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerGap: { flex: 1 },
  headerSide: { flexDirection: 'row', alignItems: 'center' },
  headerSideStart: { justifyContent: 'flex-start' },
  headerSideEnd: { justifyContent: 'flex-end' },
  headerIconAlpha: { opacity: 0.72 },

  lyricsWrap: { position: 'absolute' },
});

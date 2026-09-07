import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ClipOp,
  Skia,
  useFont,
  useImage,
  type SkCanvas,
  type SkFont,
  type SkImage,
} from '@shopify/react-native-skia';
import { Manrope_400Regular, Manrope_600SemiBold } from '@expo-google-fonts/manrope';
import { usePlayerStore } from '../lib/player-store';
import type { RootStackParamList } from '../navigation/root-navigator';
import { useFurniture } from '../lib/layout';
import { useMock, useMockMaterial } from '../lib/design/mock';
import { useBlurTarget } from '../lib/blur-target';
import { LiquidGlassButton, paintIcon } from './liquid-glass';
import { resolveAccent } from '../lib/design/accent';
import { colors } from '../lib/theme';
import { materialForInk, PRODUCT_DIM, VIREGLASS_CONTROL_MATERIAL } from '../lib/vireglass/material';

/**
 * Мини-плеер — самая заметная стеклянная поверхность продукта и единственное, что связывает
 * играющее с любым экраном.
 *
 * Это ТА ЖЕ ДЕТАЛЬ, что кнопки навигации под ней и «ПОТОК» на плеере: один примитив
 * (`LiquidGlassButton`), один материал, один отклик на палец из ядра. Раньше плашка стояла
 * на `GlassPanel` — поверхности без тяги и без пятна касания, — а название, артист и обложка
 * лежали обычными вьюхами ПОВЕРХ стекла: при нажатии тело гнулось, а краска стояла на месте.
 *
 * Слоёв краски два, и они разные по природе — ровно как в вебе (`rnd-src/mini-player.ts`):
 * надписи и значок одноканальные, живут в маске и красятся полярностью детали; обложка
 * цветная и едет вторым слоем (`u_overlay`), на той же координате и с той же деформацией.
 *
 * Сыгранную долю показывает САМО СТЕКЛО: левая часть плашки стоит в активном состоянии,
 * правая нет, граница едет слева направо (`u_progress` в ядре).
 */
export function MiniPlayer() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const track = usePlayerStore((s) => s.queue[s.queueIndex]);
  const status = usePlayerStore((s) => s.status);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const { plate, plateBottom } = useFurniture();
  const ms = useMock();
  const material = useMockMaterial(PLATE_MATERIAL);
  const blurTarget = useBlurTarget();

  // Ширина приходит замером: плашка тянется по полю экрана, а геометрия детали — число.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const measured = Math.round(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === measured ? prev : measured));
  };

  // Позиция читается ПОДПИСКОЙ, а не селектором: селектор ре-рендерил бы плашку целиком
  // несколько раз в секунду, а доехать значению нужно только до шейдера.
  const progress = useSharedValue(0);
  useEffect(() => {
    const apply = ({ positionSec, durationSec }: { positionSec: number; durationSec: number }) => {
      progress.value = durationSec > 0 ? Math.min(1, Math.max(0, positionSec / durationSec)) : 0;
    };
    apply(usePlayerStore.getState());
    return usePlayerStore.subscribe(apply);
  }, [progress]);

  const inset = ms(MOCK_INSET);
  const cover = plate - inset * 2;
  const titleFont = useFont(Manrope_600SemiBold, ms(MOCK_TITLE));
  const artistFont = useFont(Manrope_400Regular, ms(MOCK_ARTIST));
  const art = useImage(track?.coverUrl ?? null);
  const playing = status === 'playing';
  const wash = track?.accentColor ? resolveAccent(track.accentColor).wash : colors.secondary;

  // Числа считаются ДО мемо, а не внутри него: `useMock` отдаёт новую функцию на каждый
  // рендер, и с ней в зависимостях раскладка (а за ней и обе маски) пересобиралась бы
  // каждый кадр — то есть офскрин-поверхность Skia на каждый тик позиции.
  const coverRadius = ms(MOCK_COVER_RADIUS);
  const textGap = ms(MOCK_TEXT_GAP);
  const play = ms(MOCK_PLAY);
  const titleBaseline = ms(MOCK_TITLE_BASELINE);
  const artistBaseline = ms(MOCK_ARTIST_BASELINE);
  const layout = useMemo<PlateLayout>(
    () => ({
      plateW: width,
      pad: inset,
      cover,
      coverRadius,
      textGap,
      play,
      titleBaseline,
      artistBaseline,
    }),
    [width, inset, cover, coverRadius, textGap, play, titleBaseline, artistBaseline],
  );

  const paintMask = useCallback(
    (canvas: SkCanvas, boxW: number, boxH: number) => {
      if (!titleFont || !artistFont || !track) return;
      drawPlateInk(canvas, boxW, boxH, layout, {
        title: track.title,
        artist: track.artistName,
        titleFont,
        artistFont,
        playing,
      });
    },
    [layout, titleFont, artistFont, track, playing],
  );

  const paintOverlay = useCallback(
    (canvas: SkCanvas, boxW: number, boxH: number) => {
      drawPlateCover(canvas, boxW, boxH, layout, art, wash);
    },
    [layout, art, wash],
  );

  const open = useCallback(() => navigation.navigate('Player'), [navigation]);

  const onPress = useCallback(
    (local: { x: number; y: number }) => {
      if (hitPlay(layout, local)) togglePlayPause();
      else open();
    },
    [layout, togglePlayPause, open],
  );

  // Жесты кита: свайп вверх — фуллскрин, вбок — переключение трека, тап — фуллскрин.
  // Переключать музыку, не открывая плеер, — главный выигрыш мини-плеера на телефоне.
  const onFling = useCallback(
    (dx: number, dy: number) => {
      if (Math.abs(dx) <= Math.abs(dy)) {
        if (dy < -SWIPE_MIN) open();
        return;
      }
      if (Math.abs(dx) < SWIPE_MIN) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (dx < 0) next();
      else prev();
    },
    [open, next, prev],
  );

  if (!track) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          bottom: plateBottom,
          left: ms(MOCK_SCREEN_MARGIN),
          right: ms(MOCK_SCREEN_MARGIN),
          height: plate,
        },
      ]}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel={`${track.title}, ${track.artistName}. Открыть плеер`}
      accessibilityActions={ACCESSIBILITY_ACTIONS}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'togglePlay') togglePlayPause();
      }}
    >
      {width > 0 && (
        <LiquidGlassButton
          size={plate}
          width={width}
          radius={ms(MOCK_RADIUS)}
          paintMask={paintMask}
          paintOverlay={paintOverlay}
          material={material}
          blurTarget={blurTarget}
          progress={progress}
          dim={PRODUCT_DIM}
          onPress={onPress}
          onFling={onFling}
        />
      )}
    </View>
  );
}

type PlateLayout = {
  plateW: number;
  pad: number;
  cover: number;
  coverRadius: number;
  textGap: number;
  play: number;
  titleBaseline: number;
  artistBaseline: number;
};

/** Левый край плашки внутри коробки маски: коробка шире детали на запас деформации. */
const plateLeft = (boxW: number, plateW: number) => (boxW - plateW) / 2;
/** Центр значка плей/паузы отмеряется от ПРАВОГО края (веб — `playCenterX`). */
const playCenterX = (l: PlateLayout) => l.plateW - l.pad - PLAY_OFFSET - l.play / 2;

function hitPlay(l: PlateLayout, local: { x: number; y: number }): boolean {
  const hit = (l.play * MOCK_PLAY_HIT) / MOCK_PLAY;
  const middle = l.cover / 2 + l.pad;
  return Math.abs(local.x - playCenterX(l)) <= hit && Math.abs(local.y - middle) <= hit;
}

/**
 * Краска плашки в маску. Маска одноканальная: форму шейдер читает ЗЕЛЁНЫМ каналом, поэтому
 * имя артиста глушится ЦВЕТОМ (меньшей плотностью краски), а не прозрачностью — под плашкой
 * едет чужой список, и у полупрозрачной строки не остаётся запаса контраста над ним.
 */
function drawPlateInk(
  canvas: SkCanvas,
  boxW: number,
  boxH: number,
  l: PlateLayout,
  content: {
    title: string;
    artist: string;
    titleFont: SkFont;
    artistFont: SkFont;
    playing: boolean;
  },
): void {
  const left = plateLeft(boxW, l.plateW);
  const middle = boxH / 2;
  const textLeft = left + l.pad + l.cover + l.textGap;
  const textRight = left + playCenterX(l) - l.play / 2 - l.textGap;

  const fill = (hex: string) => {
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(hex));
    paint.setAntiAlias(true);
    return paint;
  };

  // Длинное название иначе уезжает под значок: в макете строки короткие, в продукте нет.
  canvas.save();
  canvas.clipRect(
    Skia.XYWHRect(textLeft, 0, Math.max(0, textRight - textLeft), boxH),
    ClipOp.Intersect,
    true,
  );
  canvas.drawText(content.title, textLeft, middle + l.titleBaseline, fill('#ffffff'), content.titleFont);
  canvas.drawText(content.artist, textLeft, middle + l.artistBaseline, fill(MUTED_INK), content.artistFont);
  canvas.restore();

  paintIcon(
    canvas,
    content.playing ? 'pause' : 'play',
    l.play,
    left + playCenterX(l) - l.play / 2,
    middle - l.play / 2,
  );
}

/** Обложка играющего трека — единственное цветное на плашке, поэтому едет вторым слоем:
 *  маска несёт один канал и краски не передаёт. */
function drawPlateCover(
  canvas: SkCanvas,
  boxW: number,
  boxH: number,
  l: PlateLayout,
  art: SkImage | null,
  wash: string,
): void {
  const left = plateLeft(boxW, l.plateW) + l.pad;
  const top = (boxH - l.cover) / 2;
  const rect = Skia.XYWHRect(left, top, l.cover, l.cover);
  const rrect = Skia.RRectXY(rect, l.coverRadius, l.coverRadius);

  if (!art) {
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(wash));
    paint.setAntiAlias(true);
    canvas.drawRRect(rrect, paint);
    return;
  }

  canvas.save();
  canvas.clipRRect(rrect, ClipOp.Intersect, true);
  // Квадрат вырезается из центра исходника: артворк не всегда квадратный, а растянутый
  // по кадру он читается браком печати.
  const side = Math.min(art.width(), art.height());
  const src = Skia.XYWHRect((art.width() - side) / 2, (art.height() - side) / 2, side, side);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  canvas.drawImageRect(art, src, rect, paint);
  canvas.restore();
}

/** Порог жеста: ниже него это дрожание пальца, а не свайп. */
const SWIPE_MIN = 24;

const ACCESSIBILITY_ACTIONS = [{ name: 'togglePlay', label: 'Играть или поставить на паузу' }];

/** Плашка — предмет управления: то же стекло, что у кнопок навигации под ней. Краску
 *  приложения она несёт, поэтому читаемость требует ядро, а не этот файл. */
const PLATE_MATERIAL = materialForInk(VIREGLASS_CONTROL_MATERIAL, true);

/** Вторую строку глушит ЦВЕТ, а не прозрачность: маска одноканальная (веб — то же). */
const MUTED_INK = '#d2d2d2';

/** Величины макета (`apps/web/rnd-src/mini-player.ts`). */
const MOCK_SCREEN_MARGIN = 20;
const MOCK_INSET = 9;
const MOCK_RADIUS = 16;
const MOCK_COVER_RADIUS = 8;
const MOCK_TEXT_GAP = 12;
const MOCK_PLAY = 22;
const MOCK_PLAY_HIT = 18;
const MOCK_TITLE = 13;
const MOCK_ARTIST = 11;
/** Базовые линии строк относительно середины плашки. */
const MOCK_TITLE_BASELINE = -2;
const MOCK_ARTIST_BASELINE = 13;
/** Зазор между значком плей и правым отступом. */
const PLAY_OFFSET = 4;

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});

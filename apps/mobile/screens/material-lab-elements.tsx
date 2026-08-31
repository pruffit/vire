import { memo, useMemo, useRef, useState, type RefObject } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassPanel } from '../components/ui/glass-panel';
import { LiquidGlassButton } from '../components/liquid-glass';
import { Icon } from '../lib/icon';
import { useFrameThrottle } from '../lib/frame-throttle';
import { useInkColor } from '../lib/vireglass/glass-ink';
import { colors } from '../lib/theme';
import { type } from '../lib/design/typography';
import { space, layout, radii } from '../lib/design/scales';
import { MINI_PLAYER_HEIGHT, PLAYER_TRANSPORT_HEIGHT, TAB_BAR_CONTENT_HEIGHT } from '../lib/layout';
import type { VireGlassDebugMode, VireGlassOptics } from '../lib/vireglass/material';

/**
 * Продуктовые поверхности внутри стенда материала.
 *
 * Собраны из ТЕХ ЖЕ `GlassPanel`/`LiquidGlassButton`, что и продукт, и с той же геометрией —
 * иначе стенд показывал бы материал на формах, которых в приложении нет, и настройка не
 * переносилась бы. Отличие ровно одно: материал приходит пропом от ползунков.
 */
export type LabSurfaceProps = {
  optics: VireGlassOptics;
  debug: VireGlassDebugMode;
  blurTarget: RefObject<View | null>;
  dim: number;
};

/** Обложка в стенде — не сеть, а яркий градиент: стекло над светлым проверяется тяжелее. */
const COVER = ['#7ee3c8', '#4aa3ff', '#b06cff'] as const;

/** Тёмный конец шкалы надписи. Кит держит светлый текст на `colors.foreground`; для обратной
 *  полярности нужен такой же «почти, но не совсем» тёмный. */
const INK_ON_LIGHT = '#14120f';

/** Содержимое поверхностей спрашивает цвет У СТЕКЛА, а не берёт его из кита: полярность
 *  решает сама поверхность, и надпись обязана ехать вместе с ней. Хук работает только внутри
 *  `GlassPanel` — поэтому содержимое вынесено в отдельные компоненты. */
function useInk() {
  return useInkColor(colors.foreground, INK_ON_LIGHT);
}

/** Цвет НА заливке цвета надписи: аргументы те же, порядок обратный. Иначе при развороте
 *  полярности диск play темнеет вместе с надписью, а треугольник на нём остаётся тёмным. */
function useOnInk() {
  return useInkColor(colors.background, colors.foreground);
}

function TransportRow() {
  const ink = useInk();
  const onInk = useOnInk();
  return (
    <>
      <Icon name="heart" size={24} color={ink} />
      <Icon name="skip-back" size={24} color={ink} />
      <View style={[styles.play, { backgroundColor: ink }]}>
        <Icon name="play" size={26} color={onInk} />
      </View>
      <Icon name="skip-forward" size={24} color={ink} />
      <Icon name="share" size={20} color={ink} />
    </>
  );
}

function MiniRow() {
  const ink = useInk();
  return (
    <>
      <LinearGradient colors={COVER} style={styles.miniCover} />
      <View style={styles.miniInfo}>
        <Text style={[type.sectionTitle, { color: ink }]} numberOfLines={1}>
          Groove Geometry
        </Text>
        <Text style={[type.caption, { color: ink, opacity: 0.62 }]} numberOfLines={1}>
          KOTLAEV DANIL
        </Text>
      </View>
      <Icon name="pause" size={20} color={ink} />
    </>
  );
}

const SheetContent = memo(function SheetContent({ bottom }: { bottom: number }) {
  const ink = useInk();
  return (
    <>
      <View style={[styles.grabber, { backgroundColor: ink, opacity: 0.28 }]} />
      <Text style={[type.screenTitle, { color: ink }]}>Очередь</Text>
      {SHEET_ROWS.map((title) => (
        <View key={title} style={styles.sheetRow}>
          <LinearGradient colors={COVER} style={styles.sheetCover} />
          <View style={styles.miniInfo}>
            <Text style={[type.row, { color: ink }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[type.caption, { color: ink, opacity: 0.62 }]} numberOfLines={1}>
              KOTLAEV DANIL
            </Text>
          </View>
        </View>
      ))}
      <View style={{ height: bottom }} />
    </>
  );
});

const TAB_ICONS = ['home', 'search', 'list', 'user'] as const;
const TAB_CIRCLE = 68;

export function LabTransport({ optics, debug, blurTarget, dim }: LabSurfaceProps) {
  return (
    <GlassPanel
      radius={PLAYER_TRANSPORT_HEIGHT / 2}
      optics={optics}
      debug={debug}
      blurTarget={blurTarget}
      dim={dim}
      style={styles.transport}
      contentStyle={styles.transportRow}
    >
      <TransportRow />
    </GlassPanel>
  );
}

export function LabMiniPlayer({ optics, debug, blurTarget, dim }: LabSurfaceProps) {
  return (
    <View style={styles.miniWrap}>
      <GlassPanel
        radius={radii.glass}
        optics={optics}
        debug={debug}
        blurTarget={blurTarget}
        dim={dim}
        style={styles.mini}
        contentStyle={styles.miniRow}
      >
        <MiniRow />
      </GlassPanel>
      <View style={styles.miniTrack} pointerEvents="none">
        <View style={styles.miniFill} />
      </View>
    </View>
  );
}

export function LabTabBar({ optics, blurTarget, dim }: LabSurfaceProps) {
  return (
    <View style={styles.tabRow}>
      {TAB_ICONS.map((icon, i) => (
        <LiquidGlassButton
          key={icon}
          size={TAB_CIRCLE}
          icon={icon}
          active={i === 0}
          optics={optics}
          blurTarget={blurTarget}
          dim={dim}
        />
      ))}
    </View>
  );
}

const SHEET_MIN = 140;
const SHEET_ROWS = ['Groove Geometry', 'Cleared Cache', 'Moss Memory', 'Untouchable', 'Interference'];

/**
 * Панель на всю ширину, вытягиваемая снизу вверх. Единственная поверхность, которая меняет
 * размер под пальцем: геометрия и униформы шейдера пересобираются на каждом кадре тяги —
 * стенд для того и нужен, чтобы увидеть, держит ли это материал.
 *
 * Панель уходит под нижнюю кромку на радиус: SDF знает один радиус на все углы, и без
 * выпуска нижние скругления висели бы в воздухе.
 */
export function LabSheet({ optics, debug, blurTarget, dim }: LabSurfaceProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const max = windowHeight - insets.top - space.xl;
  const [height, setHeight] = useState(SHEET_MIN * 2);
  // Высота меняет геометрию стекла, а с ней путь Skia и весь набор униформ линзы. Одно
  // такое пересобирание на кадр шторка держит; по событию на каждое движение пальца — нет.
  const emitHeight = useFrameThrottle(setHeight);
  // Высота ещё и в ref: держать её в зависимостях жеста нельзя — объект жеста
  // пересоздавался бы на каждом кадре тяги, и GestureDetector срывал бы перетаскивание.
  const heightRef = useRef(SHEET_MIN * 2);
  const startRef = useRef(0);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          startRef.current = heightRef.current;
        })
        .onChange((e) => {
          const next = Math.min(max, Math.max(SHEET_MIN, startRef.current - e.translationY));
          heightRef.current = next;
          emitHeight(next);
        }),
    [max, emitHeight],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.sheetWrap, { height: height + radii.sheet, bottom: -radii.sheet }]}>
        <GlassPanel
          radius={radii.sheet}
          optics={optics}
          debug={debug}
          blurTarget={blurTarget}
          dim={dim}
          style={styles.sheet}
          contentStyle={[styles.sheetContent, { paddingBottom: radii.sheet }]}
        >
          <SheetContent bottom={insets.bottom} />
        </GlassPanel>
      </View>
    </GestureDetector>
  );
}

const INSET = 8;

const styles = StyleSheet.create({
  transport: { marginHorizontal: layout.screenPadding, height: PLAYER_TRANSPORT_HEIGHT },
  transportRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
  },
  play: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.foreground,
  },

  miniWrap: { marginHorizontal: space.md, height: MINI_PLAYER_HEIGHT },
  mini: { flex: 1 },
  miniRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: INSET },
  miniCover: {
    width: MINI_PLAYER_HEIGHT - INSET * 2,
    height: MINI_PLAYER_HEIGHT - INSET * 2,
    borderRadius: radii.glass - INSET,
  },
  miniInfo: { flex: 1, gap: 2, minWidth: 0 },
  miniTrack: {
    position: 'absolute',
    left: INSET + (MINI_PLAYER_HEIGHT - INSET * 2) + space.md,
    right: INSET,
    bottom: INSET,
    height: 1.5,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  miniFill: { width: '38%', height: 1.5, backgroundColor: colors.foreground, opacity: 0.7 },

  tabRow: {
    height: TAB_BAR_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },

  sheetWrap: { position: 'absolute', left: 0, right: 0 },
  sheet: { flex: 1 },
  sheetContent: { flex: 1, overflow: 'hidden', paddingHorizontal: layout.screenPadding, gap: space.md },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: radii.full, marginTop: space.md },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sheetCover: { width: 44, height: 44, borderRadius: radii.coverSm },

});

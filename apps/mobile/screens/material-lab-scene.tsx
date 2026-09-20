import { useEffect, useMemo, memo } from 'react';
import { Dimensions, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import {
  REFERENCE_SCENES,
  REFERENCE_SCENE_HEIGHT,
  REFERENCE_SCENE_WIDTH,
  REFERENCE_SURROUND,
  refCheckerCells,
  refGradientSteps,
  refGray,
  type VireGlassRefLayer,
  type VireGlassRefScene,
} from '../lib/vireglass/material';

// Фон намеренно недружелюбный к рендереру: мелкий кегль, 1px-линии, резкие границы и
// градиенты в одном кадре. Красивый градиент для стенда не годится — он прячет артефакты.
//
// Сцена ПАРКУЕТСЯ: зона выбирается по имени и встаёт ровно под стекло. Движение осталось
// отдельным режимом, но судить по нему нельзя — замер по кадру, в котором зона под стеклом
// оказалась случайно, ничего не значит (material-lab.md E-27).

const { height: SCREEN_H } = Dimensions.get('window');

/** Высота одной зоны. Фиксированная, а не flex: парковка обязана быть арифметикой, а не
 *  измерением лейаута — иначе смещение зависит от того, когда сработал onLayout. */
export const ZONE_H = Math.round(SCREEN_H * 0.42);

const CHECKER_CELL = 8;
const CHECKER_COLS = 24;
const CHECKER_ROWS = 16;

function Checkerboard() {
  const rows = [];
  for (let r = 0; r < CHECKER_ROWS; r++) {
    const cells = [];
    for (let c = 0; c < CHECKER_COLS; c++) {
      const on = (r + c) % 2 === 0;
      cells.push(
        <View
          key={c}
          style={{
            width: CHECKER_CELL,
            height: CHECKER_CELL,
            backgroundColor: on ? '#0a0d0f' : '#eef2f4',
          }}
        />,
      );
    }
    rows.push(
      <View key={r} style={styles.checkerRow}>
        {cells}
      </View>,
    );
  }
  return <View style={styles.checkerBoard}>{rows}</View>;
}

function buildFlexLines(count: number, color: string, axis: 'row' | 'column') {
  const items = [];
  for (let i = 0; i <= count; i++) {
    items.push(<View key={`s${i}`} style={styles.lineSpacer} />);
    if (i < count) {
      const lineStyle: ViewStyle =
        axis === 'column' ? { height: 1, backgroundColor: color } : { width: 1, backgroundColor: color };
      items.push(<View key={`l${i}`} style={lineStyle} />);
    }
  }
  return items;
}

function LineGrid({ color, hCount, vCount }: { color: string; hCount: number; vCount: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.lineLayer, { flexDirection: 'column' }]}>
        {buildFlexLines(hCount, color, 'column')}
      </View>
      <View style={[styles.lineLayer, { flexDirection: 'row' }]}>
        {buildFlexLines(vCount, color, 'row')}
      </View>
    </View>
  );
}

function Flat({ color, label, labelColor }: { color: string; label: string; labelColor: string }) {
  return (
    <View style={[styles.zone, { backgroundColor: color }]}>
      <Text style={[styles.zoneLabel, { color: labelColor }]}>{label}</Text>
      <View style={[styles.hairline, { backgroundColor: labelColor }]} />
    </View>
  );
}

/** Продуктовый случай: тёмный список со светлой обложкой — именно над ним живут мини-плеер
 *  и таб-бар, и именно здесь стекло должно читаться, а не исчезать. */
function ListRows() {
  const rows = ['Groove Geometry', 'Cleared Cache', 'Moss Memory', 'Untouchable'];
  return (
    <View style={[styles.zone, styles.listZone]}>
      {rows.map((title, i) => (
        <View key={title} style={styles.listRow}>
          <LinearGradient
            colors={i % 2 === 0 ? ['#7ee3c8', '#4aa3ff'] : ['#ffd600', '#ff6b35']}
            style={styles.listCover}
          />
          <View style={styles.listText}>
            <Text style={[styles.text, { fontSize: 14 }]}>{title}</Text>
            <Text style={[styles.text, { fontSize: 11, opacity: 0.55 }]}>KOTLAEV DANIL</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TypeAndChecker() {
  return (
    <View style={[styles.zone, styles.core]}>
      <Checkerboard />
      <View style={styles.coreText}>
        <Text style={[styles.text, { fontSize: 28, fontWeight: '800' }]}>Aa Стекло 28</Text>
        <Text style={[styles.text, { fontSize: 14 }]}>Строка кегля 14px</Text>
        <Text style={[styles.text, { fontSize: 11 }]}>Мелкий текст 11px читаемость</Text>
        <View style={styles.contrastChip}>
          <Text style={styles.contrastChipText}>чёрный на белом 11px</Text>
        </View>
      </View>
    </View>
  );
}

function SaturatedZones() {
  const zones = [
    { color: '#ee0000', label: 'RED' },
    { color: '#00c853', label: 'GREEN' },
    { color: '#2962ff', label: 'BLUE' },
    { color: '#ffd600', label: 'YELLOW' },
  ];
  return (
    <View style={[styles.zone, styles.row]}>
      {zones.map((z) => (
        <View key={z.label} style={[styles.flexCell, { backgroundColor: z.color }]}>
          <Text style={styles.satLabel}>{z.label}</Text>
        </View>
      ))}
    </View>
  );
}

function HardEdgeBlocks() {
  const colors = ['#ff6b35', '#2ec4b6', '#ffbf00', '#e71d36', '#011627', '#7209b7'];
  return (
    <View style={[styles.zone, styles.blockGrid]}>
      {colors.map((c) => (
        <View key={c} style={[styles.blockCell, { backgroundColor: c }]} />
      ))}
    </View>
  );
}

function SplitZone() {
  return (
    <View style={[styles.zone, styles.row]}>
      <View style={[styles.flexCell, { backgroundColor: '#000000' }]}>
        <Text style={[styles.zoneLabel, { color: '#ffffff' }]}>#000</Text>
      </View>
      <View style={[styles.flexCell, { backgroundColor: '#ffffff' }]}>
        <Text style={[styles.zoneLabel, { color: '#000000' }]}>#fff</Text>
      </View>
    </View>
  );
}

/** Почти-чёрный градиент: единственное место, где видно БАНДИНГ. На плоской заливке его нет
 *  по построению, на пёстром фоне он тонет в деталях. */
function NearBlackRamp() {
  return (
    <View style={styles.zone}>
      <LinearGradient colors={['#000000', '#141a1e']} style={StyleSheet.absoluteFill} />
      <Text style={[styles.zoneLabel, styles.centered, { color: '#39434a' }]}>
        почти чёрный градиент · бандинг
      </Text>
    </View>
  );
}

function NearWhiteRamp() {
  return (
    <View style={styles.zone}>
      <LinearGradient colors={['#ffffff', '#e8ecef']} style={StyleSheet.absoluteFill} />
      <Text style={[styles.zoneLabel, styles.centered, { color: '#9aa7ad' }]}>
        почти белый градиент · бандинг
      </Text>
    </View>
  );
}

/**
 * СВЕРОЧНЫЕ ПОЛОТНА. Слои описаны данными в пакете и кладутся здесь вьюхами ровно так же, как
 * их рисует канвасом веб-стенд: только на ОДНОМ полотне снимки двух платформ сравнимы.
 *
 * Панель фиксированного размера в dp, а не во всю зону: узор отсчитывается от края полотна, и
 * на полотне во всю ширину фаза под деталью зависела бы от ширины экрана.
 */
function RefLayer({ layer }: { layer: VireGlassRefLayer }) {
  switch (layer.kind) {
    case 'заливка':
      return <View style={[StyleSheet.absoluteFill, { backgroundColor: refGray(layer.level) }]} />;
    case 'полосы':
      return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: refGray(layer.level) }]}>
          {Array.from({ length: Math.ceil(REFERENCE_SCENE_WIDTH / layer.periodDp) }, (_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: i * layer.periodDp,
                top: 0,
                bottom: 0,
                width: layer.widthDp,
                backgroundColor: refGray(layer.other),
              }}
            />
          ))}
        </View>
      );
    case 'ступень':
      return (
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          <View style={{ flex: 1, backgroundColor: refGray(layer.left) }} />
          <View style={{ flex: 1, backgroundColor: refGray(layer.right) }} />
        </View>
      );
    case 'черта':
      return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: refGray(layer.level), justifyContent: 'center' }]}>
          <View style={{ height: layer.thicknessDp, backgroundColor: refGray(layer.barLevel) }} />
        </View>
      );
    case 'сетка':
      return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: refGray(layer.level) }]}>
          {Array.from({ length: Math.ceil(REFERENCE_SCENE_WIDTH / layer.stepDp) + 1 }, (_, i) => (
            <View
              key={'v' + i}
              style={{ position: 'absolute', left: i * layer.stepDp, top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: refGray(layer.lineLevel) }}
            />
          ))}
          {Array.from({ length: Math.ceil(REFERENCE_SCENE_HEIGHT / layer.stepDp) + 1 }, (_, i) => (
            <View
              key={'h' + i}
              style={{ position: 'absolute', top: i * layer.stepDp, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: refGray(layer.lineLevel) }}
            />
          ))}
        </View>
      );
    case 'градиент':
      return (
        <View style={StyleSheet.absoluteFill}>
          {refGradientSteps(layer).map((level, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: refGray(level) }} />
          ))}
        </View>
      );
    case 'шахматка':
      return (
        <View style={StyleSheet.absoluteFill}>
          {refCheckerCells(layer, REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT).map((cell, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: cell.xDp,
                top: cell.yDp,
                width: layer.cellDp,
                height: layer.cellDp,
                backgroundColor: refGray(cell.level),
              }}
            />
          ))}
        </View>
      );
  }
}

function ReferenceZone({ scene }: { scene: VireGlassRefScene }) {
  return (
    <View style={[styles.zone, styles.referenceZone]}>
      <View style={{ width: REFERENCE_SCENE_WIDTH, height: REFERENCE_SCENE_HEIGHT, overflow: 'hidden' }}>
        {scene.bands(scene.level).map((band, i) => (
          <View key={i} style={{ height: band.heightDp, overflow: 'hidden' }}>
            <RefLayer layer={band.layer} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Зоны стенда. Порядок = порядок в сцене; имя = то, что выбирается чипом.
 *  Рисуются не все сразу — см. `MaterialLabSceneImpl`. */
export const LAB_ZONES = [
  { name: 'чёрный', render: () => <Flat color="#000000" label="чистый чёрный · отражать нечего" labelColor="#6a7a82" /> },
  { name: 'чёрн.градиент', render: () => <NearBlackRamp /> },
  { name: 'тёмный+линии', render: () => (
      <View style={[styles.zone, styles.darkZone]}>
        <Text style={[styles.text, { fontSize: 11 }]}>тёмная зона · тонкие линии · 11px</Text>
        <LineGrid color="#3a4750" hCount={7} vCount={10} />
      </View>
    ) },
  { name: 'список', render: () => <ListRows /> },
  { name: 'текст+шахматка', render: () => <TypeAndChecker /> },
  { name: 'граница ч/б', render: () => <SplitZone /> },
  { name: 'блоки', render: () => <HardEdgeBlocks /> },
  { name: 'спектр', render: () => (
      <View style={styles.zone}>
        <LinearGradient
          colors={['#ff3d81', '#ff8a3d', '#ffe23d', '#3dff8a', '#3d8aff', '#8a3dff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    ) },
  { name: 'насыщенные', render: () => <SaturatedZones /> },
  { name: 'светлый+линии', render: () => (
      <View style={[styles.zone, styles.lightZone]}>
        <Text style={[styles.text, styles.darkText, { fontSize: 11 }]}>
          светлая зона · тонкие линии · 11px
        </Text>
        <LineGrid color="#9aa7ad" hCount={6} vCount={9} />
      </View>
    ) },
  { name: 'бел.градиент', render: () => <NearWhiteRamp /> },
  { name: 'белый', render: () => <Flat color="#ffffff" label="чистый белый" labelColor="#5a6a72" /> },
  { name: 'серый 50%', render: () => <Flat color="#808080" label="средний серый 50%" labelColor="#1a1a1a" /> },
  // Сверочные полотна — общие с веб-стендом и с гейтом; порядок и имена берутся из пакета.
  ...REFERENCE_SCENES.map((scene) => ({ name: scene.name, render: () => <ReferenceZone scene={scene} /> })),
];

export type LabZoneName = string;
export const ZONE_NAMES = LAB_ZONES.map((z) => z.name);

const CONTENT_H = ZONE_H * LAB_ZONES.length;

/** Смещение сцены, при котором середина зоны `index` встаёт на экранную высоту `focusY`. */
export function parkOffset(index: number, focusY: number): number {
  // Ворклет: величину читает и ручная прокрутка с UI-потока, и обычный код стенда.
  'worklet';
  return focusY - (index * ZONE_H + ZONE_H / 2);
}

function MaterialLabSceneImpl({
  zone,
  focusY,
  moving,
}: {
  zone: number;
  focusY: number;
  moving: boolean;
}) {
  const t = useSharedValue(0);
  // Ручная прокрутка фона пальцем. Стекло стоит на месте, под ним едет содержимое — это
  // единственный способ увидеть адаптацию как непрерывный процесс, а не набор поз: по
  // зонам можно только прыгать, а тут видно, КАК тело догоняет фон и где полярность
  // перекидывается.
  const drag = useSharedValue(0);
  const dragFrom = useSharedValue(0);

  const scroll = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetY([-6, 6])
        .onBegin(() => {
          dragFrom.value = drag.value;
        })
        .onChange((e) => {
          drag.value = dragFrom.value + e.translationY;
        }),
    [drag, dragFrom],
  );

  // Смена зоны — абсолютная: накопленное пальцем смещение сбрасывается. Иначе `zone=N`
  // перестаёт задавать состояние однозначно, и снимок уезжает не туда, где его ждут.
  useEffect(() => {
    drag.value = 0;
  }, [zone, drag]);

  useEffect(() => {
    if (moving) {
      // Проход ТУДА-ОБРАТНО: невозвратный повтор в конце цикла прыгал в начало, и это
      // читалось сбросом сцены.
      t.value = 0;
      t.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, true);
    } else {
      t.value = withTiming(0, { duration: 160 });
    }
  }, [moving, t]);

  const travel = CONTENT_H - SCREEN_H;
  const scrollStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -travel * t.value }],
  }));

  // ПАРКОВКА — обычный стиль, без Reanimated. Ворклет захватывает обычные переменные один
  // раз и на смену зоны не пересобирается: сцена молча оставалась на прежнем фоне, а замер
  // при этом выглядел валидным. Стенду нужна детерминированность, а не плавность —
  // анимация осталась только у режима движения.
  // Зона задаёт БАЗУ, палец добавляет смещение к ней. Стиль анимированный, потому что
  // прокрутка идёт с UI-потока: гнать её через состояние значит рендерить сцену на каждый
  // кадр тяги.
  const parkedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: parkOffset(zone, focusY) + drag.value }],
  }));

  return (
    <GestureDetector gesture={scroll}>
      <View style={styles.root}>
        <Animated.View style={[styles.content, moving ? scrollStyle : parkedStyle]}>
          {LAB_ZONES.map((z, i) => (
            <View key={z.name} style={styles.slot}>
              {/* Сцена — столбик из всех зон сразу, без виртуализации: прокрутка это сдвиг, и
                  парковка обязана быть арифметикой. Тяжёлые полотна (шахматка — 336 вьюх,
                  сетка — полсотни) держать смонтированными все разом незачем: дальше соседней
                  зоны их всё равно не видно, а вьюхи считаются на каждом проходе лейаута. */}
              {Math.abs(i - zone) <= 1 ? z.render() : null}
            </View>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#0d1114' },
  content: { width: '100%', height: CONTENT_H },
  slot: { height: ZONE_H },
  zone: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 0 },
  flexCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoneLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  centered: { textAlign: 'center' },
  satLabel: { color: '#00000099', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  referenceZone: { backgroundColor: REFERENCE_SURROUND, gap: 0 },
  lightZone: { backgroundColor: '#f4f6f7', padding: 8, alignItems: 'flex-start', justifyContent: 'flex-start' },
  darkZone: { backgroundColor: '#05080a', padding: 8, alignItems: 'flex-start', justifyContent: 'flex-start' },
  text: { color: '#e6ecef' },
  darkText: { color: '#0d1114' },
  lineLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  lineSpacer: { flex: 1 },
  core: { flexDirection: 'row', backgroundColor: '#0d1114', alignItems: 'center' },
  checkerBoard: { alignSelf: 'center', marginLeft: 12 },
  checkerRow: { flexDirection: 'row' },
  coreText: { flex: 1, justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  contrastChip: {
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  contrastChipText: { color: '#0a0a0a', fontSize: 11, fontWeight: '600' },
  blockGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  blockCell: { width: '33.33%', height: '50%' },
  hairline: { width: '55%', height: 1, opacity: 0.7 },
  listZone: { backgroundColor: '#05080a', gap: 10, paddingHorizontal: 14, alignItems: 'stretch' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listCover: { width: 40, height: 40, borderRadius: 8 },
  listText: { flex: 1, gap: 2 },
});

/** Сцена не зависит ни от материала, ни от морфинга: тринадцать полноэкранных зон незачем
 *  пересобирать на каждом кадре перетаскивания ползунка. */
export const MaterialLabScene = memo(MaterialLabSceneImpl);

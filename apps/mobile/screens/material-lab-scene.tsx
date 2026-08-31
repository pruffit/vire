import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

// Фон намеренно недружелюбный к рендереру: мелкий кегль, 1px-линии, резкие границы и
// градиенты в одном кадре. Красивый градиент для стенда не годится — он прячет артефакты.

// Сцена длиннее экрана и проходит МИМО стекла целиком: короткий проезд показывал только
// пару зон, а половина сценариев (чистый чёрный, чистый белый, резкая граница) не
// доезжала. Скорость прежняя — важно видеть артефакты на движении, а не быстро пролистать.
const { height: SCREEN_H } = Dimensions.get('window');
const EXTRA = Math.round(SCREEN_H * 1.6);
const CONTENT_H = SCREEN_H + EXTRA;
const TRAVEL = EXTRA;
// Скорость подобрана так, чтобы весь набор зон проходил мимо стекла за ~8 секунд в одну
// сторону: медленнее — ждать нужную зону дольше, чем смотреть на неё.
const SPEED_MS_PER_DP = 6;

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

function SaturatedZones() {
  const zones = [
    { color: '#ee0000', label: 'RED' },
    { color: '#00c853', label: 'GREEN' },
    { color: '#2962ff', label: 'BLUE' },
    { color: '#ffd600', label: 'YELLOW' },
  ];
  return (
    <View style={styles.row}>
      {zones.map((z) => (
        <View key={z.label} style={[styles.flexCell, { backgroundColor: z.color }]}>
          <Text style={styles.zoneLabel}>{z.label}</Text>
        </View>
      ))}
    </View>
  );
}

function HardEdgeBlocks() {
  const colors = ['#ff6b35', '#2ec4b6', '#ffbf00', '#e71d36', '#011627', '#7209b7'];
  return (
    <View style={styles.blockGrid}>
      {colors.map((c) => (
        <View key={c} style={[styles.blockCell, { backgroundColor: c }]} />
      ))}
    </View>
  );
}

/**
 * Крайние случаи, на которых стекло и ломается. Чистый чёрный — самый частый фон продукта
 * и единственное место, где отражать нечего: если поверхность на нём исчезает, это видно
 * только здесь. Чистый белый — обратный предел. Резкая граница между ними ловит алиасинг
 * и хроматику, которых на градиенте не разглядеть.
 */
function ExtremeZone({ color, label, labelColor }: { color: string; label: string; labelColor: string }) {
  return (
    <View style={[styles.extreme, { backgroundColor: color }]}>
      <Text style={[styles.extremeLabel, { color: labelColor }]}>{label}</Text>
      <View style={[styles.hairline, { backgroundColor: labelColor }]} />
    </View>
  );
}

function SplitZone() {
  return (
    <View style={styles.row}>
      <View style={[styles.flexCell, { backgroundColor: '#000000' }]}>
        <Text style={[styles.extremeLabel, { color: '#ffffff' }]}>#000</Text>
      </View>
      <View style={[styles.flexCell, { backgroundColor: '#ffffff' }]}>
        <Text style={[styles.extremeLabel, { color: '#000000' }]}>#fff</Text>
      </View>
    </View>
  );
}

/** Продуктовый случай: тёмный список со светлой обложкой — именно над ним живут мини-плеер
 *  и таб-бар, и именно здесь стекло должно читаться, а не исчезать. */
function ListRows() {
  const rows = ['Groove Geometry', 'Cleared Cache', 'Moss Memory', 'Untouchable'];
  return (
    <View style={styles.listZone}>
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

function CoreSection() {
  return (
    <View style={styles.core}>
      <Checkerboard />
      <View style={styles.coreText}>
        <Text style={[styles.text, { fontSize: 32, fontWeight: '800' }]}>Aa Стекло 32</Text>
        <Text style={[styles.text, { fontSize: 18 }]}>Строка кегля 18px</Text>
        <Text style={[styles.text, { fontSize: 14 }]}>Строка кегля 14px</Text>
        <Text style={[styles.text, { fontSize: 11 }]}>Мелкий текст 11px читаемость</Text>
        <Text style={[styles.text, { fontSize: 10 }]}>Мелкий текст 10px читаемость края</Text>
        <View style={styles.contrastChip}>
          <Text style={styles.contrastChipText}>чёрный на белом 11px</Text>
        </View>
      </View>
    </View>
  );
}

export function MaterialLabScene({ moving }: { moving: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (moving) {
      // Проход ТУДА-ОБРАТНО: невозвратный повтор в конце цикла прыгал в начало, и это
      // читалось сбросом сцены. Заодно каждая зона проходит мимо стекла дважды.
      t.value = withRepeat(
        withTiming(1, { duration: TRAVEL * SPEED_MS_PER_DP, easing: Easing.linear }),
        -1,
        true,
      );
    } else {
      t.value = 0;
    }
  }, [moving, t]);

  const scrollStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -TRAVEL * t.value }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.content, scrollStyle]}>
        <View style={styles.flex1}>
          <SaturatedZones />
        </View>

        <View style={styles.flex1_5}>
          <LinearGradient
            colors={['#ff3d81', '#ff8a3d', '#ffe23d', '#3dff8a', '#3d8aff', '#8a3dff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={[styles.flex1_2, styles.lightZone]}>
          <Text style={[styles.text, styles.darkText, { fontSize: 11 }]}>
            светлая зона · тонкие линии · 11px
          </Text>
          <LineGrid color="#9aa7ad" hCount={6} vCount={9} />
        </View>

        <View style={styles.flex2_5}>
          <CoreSection />
        </View>

        <View style={styles.flex1_2}>
          <HardEdgeBlocks />
        </View>

        <View style={[styles.flex1_5, styles.darkZone]}>
          <Text style={[styles.text, { fontSize: 11 }]}>тёмная зона · тонкие линии · 11px</Text>
          <LineGrid color="#3a4750" hCount={7} vCount={10} />
        </View>

        <View style={styles.flex1}>
          <LinearGradient
            colors={['#0d1114', '#1b3a3f', '#5ecfc6', '#1b3a3f', '#0d1114']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.flex1_5}>
          <ListRows />
        </View>

        <View style={styles.flex1_2}>
          <ExtremeZone color="#000000" label="чистый чёрный · отражать нечего" labelColor="#6a7a82" />
        </View>

        <View style={styles.flex1_2}>
          <ExtremeZone color="#ffffff" label="чистый белый" labelColor="#5a6a72" />
        </View>

        <View style={styles.flex1}>
          <SplitZone />
        </View>

        <View style={styles.flex1}>
          <ExtremeZone color="#808080" label="средний серый 50%" labelColor="#1a1a1a" />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#0d1114' },
  content: { width: '100%', height: CONTENT_H, flexDirection: 'column' },
  flex1: { flex: 1 },
  flex1_2: { flex: 1.2 },
  flex1_5: { flex: 1.5 },
  flex2_5: { flex: 2.5 },
  row: { flex: 1, flexDirection: 'row' },
  flexCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoneLabel: { color: '#00000099', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  lightZone: { backgroundColor: '#f4f6f7', padding: 8 },
  darkZone: { backgroundColor: '#05080a', padding: 8 },
  text: { color: '#e6ecef' },
  darkText: { color: '#0d1114' },
  lineLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  lineSpacer: { flex: 1 },
  core: { flex: 1, flexDirection: 'row', backgroundColor: '#0d1114' },
  checkerBoard: { alignSelf: 'center', marginLeft: 12 },
  checkerRow: { flexDirection: 'row' },
  coreText: { flex: 1, justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  contrastChip: { backgroundColor: '#ffffff', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  contrastChipText: { color: '#0a0a0a', fontSize: 11, fontWeight: '600' },
  blockGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  blockCell: { width: '33.33%', height: '50%' },
  extreme: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  extremeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  hairline: { width: '55%', height: 1, opacity: 0.7 },
  listZone: { flex: 1, backgroundColor: '#05080a', justifyContent: 'center', gap: 10, paddingHorizontal: 14 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listCover: { width: 40, height: 40, borderRadius: 8 },
  listText: { flex: 1, gap: 2 },
});

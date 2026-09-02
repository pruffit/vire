import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, type View as RNView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassPanel } from '../ui/glass-panel';
import { useFrameThrottle } from '../../lib/frame-throttle';
import { colors } from '../../lib/theme';
import { space, layout, radii } from '../../lib/design/scales';
import { PRODUCT_DIM } from '../../lib/vireglass/material';

/** В покое видна только ручка с зазором — намёк, что поверхность тянется. Экспортируется:
 *  по этой величине плеер поднимает транспорт, чтобы тот не сел на шторку. */
export const SHEET_COLLAPSED = 56;
const COLLAPSED = SHEET_COLLAPSED;

/**
 * Стеклянная шторка плеера: тянется от ручки вверх и накрывает обложку.
 *
 * Жест живёт на ручке, а не на всей панели: внутри вертикальный скролл, и общий Pan
 * съедал бы его начало. Тянуть за ручку — единственное место, где два вертикальных жеста
 * не спорят.
 *
 * Панель уходит под нижнюю кромку на радиус: SDF знает один радиус на все углы, и без
 * выпуска нижние скругления висели бы в воздухе.
 */
export function PlayerSheet({
  blurTarget,
  children,
}: {
  blurTarget: RefObject<RNView | null>;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const max = windowHeight - insets.top - space.xl;
  const [height, setHeight] = useState(COLLAPSED);
  // Высота меняет геометрию стекла, а с ней путь Skia и весь набор униформ линзы. Одно
  // такое пересобирание на кадр шторка держит; по событию на каждое движение пальца — нет.
  const emitHeight = useFrameThrottle(setHeight);
  // Высота ещё и в ref: держать её в зависимостях жеста нельзя — объект жеста
  // пересоздавался бы на каждом кадре тяги, и GestureDetector срывал бы перетаскивание.
  const heightRef = useRef(COLLAPSED);
  const startRef = useRef(0);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          startRef.current = heightRef.current;
        })
        .onChange((e) => {
          const next = Math.min(max, Math.max(COLLAPSED, startRef.current - e.translationY));
          heightRef.current = next;
          emitHeight(next);
        })
        // Доводка до ближайшего края: шторка, брошенная посередине, читается забытой.
        .onEnd(() => {
          const settled = heightRef.current > (COLLAPSED + max) / 2 ? max : COLLAPSED;
          heightRef.current = settled;
          setHeight(settled);
        }),
    [max, emitHeight],
  );

  const open = height > COLLAPSED + 1;

  return (
    <View style={[styles.wrap, { height: height + radii.sheet, bottom: -radii.sheet }]}>
      <GlassPanel
        radius={radii.sheet}
        blurTarget={blurTarget}
        dim={PRODUCT_DIM}
        style={styles.sheet}
        contentStyle={styles.content}
      >
        <GestureDetector gesture={gesture}>
          <View style={styles.grabArea} accessibilityRole="adjustable" accessibilityLabel="Подробности о треке">
            <View style={styles.grabber} />
          </View>
        </GestureDetector>
        <ScrollView
          scrollEnabled={open}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + radii.sheet + space.lg }]}
        >
          {children}
        </ScrollView>
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0 },
  sheet: { flex: 1 },
  content: { flex: 1, overflow: 'hidden' },
  grabArea: { minHeight: layout.touchTarget, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 36, height: 4, borderRadius: radii.full, backgroundColor: colors.border },
  scroll: { paddingHorizontal: layout.screenPadding, gap: space.lg },
});

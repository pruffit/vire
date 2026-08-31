import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { radii, space } from '../../lib/design/scales';
import { formatDuration } from '../../lib/format';
import { resamplePeaks, WAVEFORM_BARS } from '../../lib/playback/waveform-peaks';

/** Целевой шаг «столбик + зазор», dp — от него считается число столбиков по ширине. */
const BAR_PITCH = 5;
const MIN_BARS = 24;
/** Хаптик-тик при перетаскивании — раз в столько проскроленных секунд. */
const HAPTIC_TICK_SEC = 5;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Скраббер по предрассчитанным пикам.
 *
 * Пики приходят вместе с манифестом (`waveformPeaks`) — бесплатно, отдельного запроса нет.
 * Столбики — обычные `View`, не Skia: их несколько десятков, а каждый Skia-канвас это ещё
 * одна GPU-поверхность, которых у нас измеренный бюджет (`lib/design/glass-budget.ts`).
 */
export function Waveform({
  peaks,
  positionSec,
  durationSec,
  onSeek,
  height = 40,
}: {
  peaks: number[] | null;
  positionSec: number;
  durationSec: number;
  onSeek: (sec: number) => void;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<{ x: number; sec: number } | null>(null);
  const lastTick = useRef(-1);

  const barCount = width > 0 ? Math.max(MIN_BARS, Math.round(width / BAR_PITCH)) : WAVEFORM_BARS;
  const bars = useMemo(() => resamplePeaks(peaks, barCount), [peaks, barCount]);

  const activeSec = drag ? drag.sec : positionSec;
  const progress = durationSec > 0 ? clamp01(activeSec / durationSec) : 0;
  const playedBars = Math.round(progress * bars.length);

  const gesture = useMemo(() => {
    // runOnJS: ворклет-колбэки Pan в связке RNGH 2.32 + reanimated 4 молча не выполняются
    // (та же грабля, что у LiquidGlassButton).
    const seekAt = (x: number, releasing: boolean) => {
      if (durationSec <= 0 || width <= 0) return;
      const clampedX = Math.min(width, Math.max(0, x));
      const sec = (clampedX / width) * durationSec;
      const tick = Math.floor(sec / HAPTIC_TICK_SEC);
      if (tick !== lastTick.current) {
        lastTick.current = tick;
        Haptics.selectionAsync().catch(() => {});
      }
      setDrag(releasing ? null : { x: clampedX, sec });
      onSeek(sec);
    };
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => {
        lastTick.current = -1;
        seekAt(e.x, false);
      })
      .onChange((e) => seekAt(e.x, false))
      .onEnd((e) => seekAt(e.x, true));
  }, [durationSec, width, onSeek]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.host, { height }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="Позиция в треке"
      >
        {bars.map((peak, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: Math.max(2, peak * height) },
              i < playedBars ? styles.barPlayed : styles.barPending,
            ]}
          />
        ))}
        {width > 0 && (
          <View style={[styles.playhead, { left: progress * width - 1, height }]} pointerEvents="none" />
        )}
        {drag && width > 0 && (
          <View style={[styles.bubble, { left: clamp01(drag.x / width) * width }]} pointerEvents="none">
            <Text style={type.mono}>{formatDuration(drag.sec)}</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const BUBBLE_OFFSET = 34;

const styles = StyleSheet.create({
  host: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { flex: 1, borderRadius: 1, minWidth: 2 },
  barPlayed: { backgroundColor: colors.foreground },
  barPending: { backgroundColor: colors.foreground, opacity: 0.22 },
  playhead: { position: 'absolute', top: 0, width: 2, borderRadius: 1, backgroundColor: colors.foreground },
  bubble: {
    position: 'absolute',
    bottom: BUBBLE_OFFSET,
    transform: [{ translateX: -18 }],
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radii.card,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: colors.border,
  },
});

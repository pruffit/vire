import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors } from '../../lib/theme';
import { radii } from '../../lib/design/scales';
import { resamplePeaks } from '../../lib/playback/waveform-peaks';

/**
 * Скраббер по предрассчитанным пикам.
 *
 * Пики приходят вместе с манифестом (`waveformPeaks`) — бесплатно, отдельного запроса нет.
 * Столбики — обычные `View`, не Skia: их полсотни, а каждый Skia-канвас это ещё одна
 * GPU-поверхность, которых у нас измеренный бюджет (`lib/design/glass-budget.ts`).
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
  const bars = useMemo(() => resamplePeaks(peaks), [peaks]);
  const progress = durationSec > 0 ? Math.min(1, Math.max(0, positionSec / durationSec)) : 0;
  const playedBars = Math.round(progress * bars.length);

  // Ширина нужна обработчику жеста; ref, а не стейт — иначе каждый layout перерисовывал бы
  // все столбики.
  const width = useRef(0);

  const gesture = useMemo(() => {
    // runOnJS: ворклет-колбэки Pan в связке RNGH 2.32 + reanimated 4 молча не выполняются
    // (та же грабля, что у LiquidGlassButton).
    const seekAt = (x: number) => {
      if (durationSec <= 0 || width.current <= 0) return;
      onSeek(Math.min(durationSec, Math.max(0, (x / width.current) * durationSec)));
    };
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => seekAt(e.x))
      .onChange((e) => seekAt(e.x));
  }, [durationSec, onSeek]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.host, { height }]}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
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
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  host: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { flex: 1, borderRadius: radii.full, minWidth: 2 },
  barPlayed: { backgroundColor: colors.foreground },
  barPending: { backgroundColor: colors.border },
});

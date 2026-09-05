import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { radii, space } from '../../lib/design/scales';
import { formatDuration } from '../../lib/format';

const TRACK = 3;
const KNOB = 12;
/** Тач-зона: сама линия в 3 dp пальцем не берётся. */
const TOUCH = 28;
/** Хаптик-тик при перетаскивании — раз в столько проскроленных секунд. */
const HAPTIC_TICK_SEC = 5;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Позиция в треке линией. До этого здесь стояла волна из пиков: сорок dp высоты и вес,
 * спорящий с транспортом, ради одной величины, которую линия отдаёт в трёх.
 */
export function ProgressLine({
  positionSec,
  durationSec,
  accent,
  onSeek,
}: {
  positionSec: number;
  durationSec: number;
  accent: string;
  onSeek: (sec: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [dragSec, setDragSec] = useState<number | null>(null);
  const lastTick = useRef(-1);

  const shownSec = dragSec ?? positionSec;
  const progress = durationSec > 0 ? clamp01(shownSec / durationSec) : 0;

  const gesture = useMemo(() => {
    // runOnJS: ворклет-колбэки Pan в связке RNGH 2.32 + reanimated 4 молча не выполняются.
    const seekAt = (x: number, releasing: boolean) => {
      if (durationSec <= 0 || width <= 0) return;
      const sec = (Math.min(width, Math.max(0, x)) / width) * durationSec;
      const tick = Math.floor(sec / HAPTIC_TICK_SEC);
      if (tick !== lastTick.current) {
        lastTick.current = tick;
        Haptics.selectionAsync().catch(() => {});
      }
      setDragSec(releasing ? null : sec);
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
    <View style={styles.host}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.touch}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel="Позиция в треке"
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
          </View>
          {width > 0 && (
            <View
              style={[styles.knob, { left: progress * width - KNOB / 2, backgroundColor: accent }]}
              pointerEvents="none"
            />
          )}
        </View>
      </GestureDetector>
      <View style={styles.times}>
        <Text style={type.mono}>{formatDuration(shownSec)}</Text>
        <Text style={type.mono}>{formatDuration(durationSec)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { gap: space.xs },
  touch: { height: TOUCH, justifyContent: 'center' },
  track: {
    height: TRACK,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  fill: { height: TRACK, borderRadius: radii.full },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: radii.full,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
});

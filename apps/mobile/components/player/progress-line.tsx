import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { type } from '../../lib/design/typography';
import { radii } from '../../lib/design/scales';
import { useMock } from '../../lib/design/mock';
import { formatDuration } from '../../lib/format';

/** Величины макета; на экране пересчитываются пропорцией (`lib/design/mock.ts`). */
const MOCK_TRACK = 4;
const MOCK_KNOB = 12;
const MOCK_TIME_GAP = 8;
const TRACK_COLOR = '#39404f';
const FILL_COLOR = '#e6eaf2';
const TIME_COLOR = '#8892a4';
/** Тач-зона добирается hitSlop: сама линия пальцем не берётся, но и высоту занимать не должна. */
const TOUCH = 14;
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
  onSeek,
}: {
  positionSec: number;
  durationSec: number;
  onSeek: (sec: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [dragSec, setDragSec] = useState<number | null>(null);
  const lastTick = useRef(-1);
  const ms = useMock();

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

  const track = ms(MOCK_TRACK);
  const knob = ms(MOCK_KNOB);

  return (
    <View style={{ gap: ms(MOCK_TIME_GAP) }}>
      <GestureDetector gesture={gesture}>
        <View
          hitSlop={TOUCH}
          style={styles.touch}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel="Позиция в треке"
        >
          <View style={[styles.track, { height: track }]}>
            <View style={[styles.fill, { height: track, width: `${progress * 100}%` }]} />
          </View>
          {width > 0 && (
            <View
              style={[styles.knob, { width: knob, height: knob, left: progress * width - knob / 2 }]}
              pointerEvents="none"
            />
          )}
        </View>
      </GestureDetector>
      <View style={styles.times}>
        <Text style={styles.time}>{formatDuration(shownSec)}</Text>
        <Text style={styles.time}>{formatDuration(durationSec)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Высоту ряда даёт сама полоса: бокс в 28 dp поднимал всю стопку экрана. */
  touch: { justifyContent: 'center' },
  track: { borderRadius: radii.full, backgroundColor: TRACK_COLOR, overflow: 'hidden' },
  fill: { borderRadius: radii.full, backgroundColor: FILL_COLOR },
  knob: { position: 'absolute', borderRadius: radii.full, backgroundColor: FILL_COLOR },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  /** Разрядка моно-стиля кита задана под ПРОПИСНЫЕ метки; на цифрах таймкода она
   *  рассыпает их в строчку из отдельных знаков. */
  time: { ...type.mono, letterSpacing: 0, color: TIME_COLOR },
});

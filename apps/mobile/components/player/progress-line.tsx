import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { type } from '../../lib/design/typography';
import { radii } from '../../lib/design/scales';
import { useMock } from '../../lib/design/mock';
import { formatDuration } from '../../lib/format';
import { VireGlassSurface } from '../vireglass/glass-surface';
import { circleGeometry } from '../../lib/vireglass/geometry';
import { materialForInk, resolveOptics, VIREGLASS_CONTROL_MATERIAL } from '../../lib/vireglass/material';
import { createDeform, raiseIntoGlass, type DeformSample } from '../../lib/vireglass/touch-response';
import { useEnvironmentLight } from '../../lib/vireglass/environment';

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

/**
 * Ручка под пальцем ПОДНИМАЕТСЯ В СТЕКЛО (эталон §5): матовая шайба уступает место стеклу,
 * деталь растёт и отрывается от дорожки. Дорожки СКВОЗЬ неё видно не будет — внутри экрана
 * нативной линзы нет (ADR-001 §2), и это граница платформы, а не недоделка: остаются форма,
 * фаска, кромочный блик и тень.
 *
 * Стеклянная ручка крупнее матовой: у стекла есть кромка и фаска, и на двенадцати точках от
 * них остаётся одна засветка.
 */
const MOCK_GLASS_KNOB = 26;
/** Рост под пальцем — трансформом обёртки: вся геометрия движения живёт в одном месте, менять
 *  габарит детали покадрово нельзя (перераскладка и новый RenderEffect на каждом кадре). */
const KNOB_GROW = 0.18;

const REST_SAMPLE: DeformSample = {
  touchX: 0, touchY: 0, pullX: 0, pullY: 0, press: 0, active: 0, waveAmp: 0, wavePhase: 0,
};

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

  // Отклик и доли перехода считает ЯДРО: пружина у ручки та же, что у кнопок, а сколько сейчас
  // стекла и сколько матовости — правило эталона, а не подобранные здесь числа.
  const deform = useMemo(() => createDeform(), []);
  const touch = useSharedValue<DeformSample>(REST_SAMPLE);
  const glass = useSharedValue(0);
  const solid = useSharedValue(1);
  const zero = useSharedValue(0);

  const knobSize = ms(MOCK_GLASS_KNOB);
  // `ms` — новая функция на каждый рендер (`lib/design/mock.ts`), а ProgressLine
  // перерисовывается на каждый семпл перетаскивания. Держим в зависимостях ЧИСЛО: иначе
  // геометрия пересобиралась бы каждый кадр жеста и тянула за собой униформы поверхности.
  const knobGeometry = useMemo(() => circleGeometry(knobSize), [knobSize]);
  // Краски на ручке нет, поэтому и требования читаемости у неё нет — стекло остаётся стеклом.
  const knobOptics = useMemo(
    () => resolveOptics(materialForInk(VIREGLASS_CONTROL_MATERIAL, false)),
    [],
  );
  // Отклик на наклон — тот же, что у остальных деталей этого материала; хардкод нуля выключал
  // бы кромочный свет ручке, хотя материал его предполагает.
  const light = useEnvironmentLight(knobOptics.environment);

  // Стекло существует только на время жеста. В покое его нет вовсе — иначе канвас Skia
  // рисовался бы всё время, пока открыт плеер, ради детали с нулевым `appear`.
  const [raised, setRaised] = useState(false);
  const running = useRef(false);
  const wake = useCallback(() => {
    if (running.current) return;
    running.current = true;
    let last = Date.now();
    const frame = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      deform.step(dt);
      const sample = deform.sample();
      touch.value = sample;
      const shown = raiseIntoGlass(sample.press);
      glass.value = shown.glass;
      solid.value = shown.solid;
      if (deform.idle()) {
        running.current = false;
        setRaised(false);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [deform, touch, glass, solid]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + KNOB_GROW * touch.value.press }],
  }));
  const solidStyle = useAnimatedStyle(() => ({ opacity: solid.value }));

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
        // Тяги у ручки нет — она ЕЗДИТ по дорожке, а не тянется за пальцем; от касания ей
        // нужно только нажатие, по которому считается подъём.
        deform.grab(0, 0, 0);
        setRaised(true);
        wake();
        seekAt(e.x, false);
      })
      .onChange((e) => seekAt(e.x, false))
      .onEnd((e) => seekAt(e.x, true))
      .onFinalize(() => {
        deform.release(0);
        wake();
      });
  }, [durationSec, width, onSeek, deform, wake]);

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
            <Animated.View
              style={[
                styles.knob,
                { width: knobGeometry.width, height: knobGeometry.height },
                { left: progress * width - knobGeometry.width / 2 },
                knobStyle,
              ]}
              pointerEvents="none"
            >
              {/* Матовая шайба — то, чем ручка является в покое. Гаснет ровно настолько,
                  насколько поднялось стекло: доли перекрываются, иначе на середине перехода
                  ручки не видно вовсе. */}
              <Animated.View
                style={[
                  styles.knobSolid,
                  { width: knob, height: knob, borderRadius: knob / 2 },
                  solidStyle,
                ]}
              />
              {/* Бэкдропа у ручки нет намеренно: внутри экрана линза невозможна, а просить
                  захват значило бы занимать бюджет поверхностей ради ничего. */}
              {raised && (
                <VireGlassSurface
                  geometry={knobGeometry}
                  optics={knobOptics}
                  dynamics={{ shiftX: zero, shiftY: zero, press: zero, active: zero, light }}
                  touch={touch}
                  appear={glass}
                  lift={1}
                  backdrop={false}
                  style={StyleSheet.absoluteFill}
                />
              )}
            </Animated.View>
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
  /** Бокс ручки: фон ему не нужен — его несут матовая шайба и стекло внутри. */
  knob: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  knobSolid: { backgroundColor: FILL_COLOR },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  /** Разрядка моно-стиля кита задана под ПРОПИСНЫЕ метки; на цифрах таймкода она
   *  рассыпает их в строчку из отдельных знаков. */
  time: { ...type.mono, letterSpacing: 0, color: TIME_COLOR },
});

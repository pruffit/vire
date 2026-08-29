import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';
import { VireGlassSurface } from '../components/vireglass/glass-surface';
import { MaterialLabScene } from './material-lab-scene';
import type { VireGlassMorph } from '../lib/vireglass/adapters';
import { useEnvironmentLight } from '../lib/vireglass/environment';
import {
  capsuleGeometry,
  circleGeometry,
  roundedRectGeometry,
  type VireGlassGeometry,
} from '../lib/vireglass/geometry';
import {
  ALL_EFFECTS_ON,
  applyToggles,
  DEBUG_MODES,
  EFFECTS,
  MATERIAL_PRESETS,
  MATERIAL_RANGES,
  PRESET_NAMES,
  resolveMaterial,
  VIREGLASS_MATERIAL_V1,
  type MaterialPresetName,
  type VireGlassDebugMode,
  type VireGlassMaterial,
  type VireGlassNumericKey,
  type VireGlassToggles,
} from '../lib/vireglass/material';

// Стенд материала VireGlass. В продовый UI не входит: EXPO_PUBLIC_GLASS_LAB=material (App.tsx).
// Журнал экспериментов — docs/vireglass/material-lab.md.

const SHAPES = {
  круг: circleGeometry(120),
  капсула: capsuleGeometry(240, 72),
  плашка: roundedRectGeometry(260, 140, 36),
} satisfies Record<string, VireGlassGeometry>;

type ShapeName = keyof typeof SHAPES;
const SHAPE_NAMES = Object.keys(SHAPES) as ShapeName[];

const TINTS = {
  нейтральный: { r: 0.4, g: 0.4, b: 0.44 },
  тёплый: { r: 0.48, g: 0.42, b: 0.34 },
  холодный: { r: 0.34, g: 0.4, b: 0.5 },
};

type TintName = keyof typeof TINTS;
const TINT_NAMES = Object.keys(TINTS) as TintName[];

const SLIDER_KEYS = Object.keys(MATERIAL_RANGES) as VireGlassNumericKey[];

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [width, setWidth] = useState(0);
  // runOnJS: ворклет-колбэки Pan в связке RNGH 2.32 + reanimated 4 молча не выполняются.
  // activeOffsetX обязателен: без него слайдер перехватывает вертикальный свайп и панель
  // перестаёт прокручиваться — вместо прокрутки уезжает значение под пальцем.
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-8, 8])
        .failOffsetY([-12, 12])
        // Значение ставится с активации, а не с касания: иначе попытка прокрутить панель
        // успевала сдвинуть ползунок ещё до того, как жест признан горизонтальным.
        .onStart((e) => {
          if (width > 0) onChange(min + ((max - min) * Math.min(Math.max(e.x, 0), width)) / width);
        })
        .onChange((e) => {
          if (width > 0) onChange(min + ((max - min) * Math.min(Math.max(e.x, 0), width)) / width);
        }),
    [width, min, max, onChange],
  );

  const fill = max > min ? (value - min) / (max - min) : 0;

  return (
    <View style={styles.slider}>
      <View style={styles.sliderHead}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{value.toFixed(2)}</Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View style={styles.trackHit} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.round(fill * 100)}%` }]} />
          </View>
          <View style={[styles.knob, { left: Math.max(0, fill * width - 7) }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

export function MaterialLab() {
  const targetRef = useRef<View>(null);
  const insets = useSafeAreaInsets();

  const [preset, setPreset] = useState<MaterialPresetName>('Material v1');
  const [base, setBase] = useState<VireGlassMaterial>(VIREGLASS_MATERIAL_V1);
  const [toggles, setToggles] = useState<VireGlassToggles>(ALL_EFFECTS_ON);
  const [debug, setDebug] = useState<VireGlassDebugMode>('normal');
  const [shape, setShape] = useState<ShapeName>('круг');
  const [tint, setTint] = useState<TintName>('нейтральный');
  const [count, setCount] = useState(1);
  const [moving, setMoving] = useState(true);
  const [morphOn, setMorphOn] = useState(false);
  const [morphT, setMorphT] = useState(0);
  const [lit, setLit] = useState(false);
  const [panel, setPanel] = useState(true);

  const material = useMemo(() => applyToggles(base, toggles), [base, toggles]);
  const geometry = SHAPES[shape];

  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const press = useSharedValue(0);
  const active = useSharedValue(0);
  const light = useEnvironmentLight(material.environment);
  useEffect(() => {
    active.value = withTiming(lit ? 1 : 0, { duration: 240 });
  }, [lit, active]);

  const morph = useMemo<VireGlassMorph | undefined>(() => {
    if (!morphOn) return undefined;
    const half = Math.min(geometry.width, geometry.height) / 2;
    return {
      offsetX: geometry.width * (1.6 - 1.05 * morphT),
      offsetY: 0,
      width: geometry.width,
      height: geometry.height,
      cornerRadius: geometry.cornerRadius,
      smoothing: half * 0.35 * morphT,
    };
  }, [morphOn, morphT, geometry]);

  const applyPreset = (name: MaterialPresetName) => {
    setPreset(name);
    setBase(MATERIAL_PRESETS[name]);
  };

  const setParam = (key: VireGlassNumericKey, v: number) => {
    const patch = { [key]: v } as Partial<VireGlassMaterial>;
    setBase((m) => resolveMaterial({ ...m, ...patch }));
  };

  const surfaces = morphOn ? [0] : Array.from({ length: count }, (_, i) => i);

  return (
    <View style={styles.root}>
      {/* Цель блюра оборачивает ТОЛЬКО фон. Стекло внутри своей же цели замыкает дерево
          RenderNode и роняет рантайм переполнением стека в prepareTreeImpl. */}
      <BlurTargetView style={StyleSheet.absoluteFill} ref={targetRef}>
        <MaterialLabScene moving={moving} />
      </BlurTargetView>

      <View style={styles.stage} pointerEvents="none">
        {surfaces.map((i) => (
          <VireGlassSurface
            key={i}
            geometry={geometry}
            material={material}
            dynamics={{ shiftX, shiftY, press, active, light }}
            debug={debug}
            morph={morph}
            backdrop={toggles.backdrop}
            blurTarget={targetRef}
          />
        ))}
      </View>

      <Text style={[styles.hud, { top: insets.top + 8 }]}>
        {preset} · {shape} · {debug}
        {morphOn ? ` · морфинг ${morphT.toFixed(2)}` : ''}
      </Text>

      <View style={[styles.panelWrap, panel && styles.panelWrapFilled, { bottom: 0, paddingBottom: insets.bottom + 8 }]}>
        <Pressable style={styles.panelToggle} onPress={() => setPanel((p) => !p)}>
          <Text style={styles.panelToggleText}>{panel ? 'скрыть панель' : 'показать панель'}</Text>
        </Pressable>
        {panel ? (
          <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
            <Text style={styles.section}>пресеты</Text>
            <View style={styles.wrap}>
              {PRESET_NAMES.map((n) => (
                <Chip key={n} label={n} on={preset === n} onPress={() => applyPreset(n)} />
              ))}
            </View>

            <Text style={styles.section}>эффекты</Text>
            <View style={styles.wrap}>
              {EFFECTS.map((e) => (
                <Chip
                  key={e}
                  label={e}
                  on={toggles[e]}
                  onPress={() => setToggles((t) => ({ ...t, [e]: !t[e] }))}
                />
              ))}
            </View>

            <Text style={styles.section}>debug</Text>
            <View style={styles.wrap}>
              {DEBUG_MODES.map((m) => (
                <Chip key={m} label={m} on={debug === m} onPress={() => setDebug(m)} />
              ))}
            </View>

            <Text style={styles.section}>сцена</Text>
            <View style={styles.wrap}>
              {SHAPE_NAMES.map((s) => (
                <Chip key={s} label={s} on={shape === s} onPress={() => setShape(s)} />
              ))}
              {[1, 2, 3].map((c) => (
                <Chip
                  key={c}
                  label={`${c} шт`}
                  on={!morphOn && count === c}
                  onPress={() => {
                    setMorphOn(false);
                    setCount(c);
                  }}
                />
              ))}
              <Chip label="движение фона" on={moving} onPress={() => setMoving((v) => !v)} />
              <Chip label="активное" on={lit} onPress={() => setLit((v) => !v)} />
            </View>

            <Text style={styles.section}>тинт</Text>
            <View style={styles.wrap}>
              {TINT_NAMES.map((n) => (
                <Chip
                  key={n}
                  label={n}
                  on={tint === n}
                  onPress={() => {
                    setTint(n);
                    setBase((m) => resolveMaterial({ ...m, tint: TINTS[n] }));
                  }}
                />
              ))}
            </View>

            <Text style={styles.section}>морфинг</Text>
            <Text style={styles.note}>
              Ведут ли две поверхности себя как одна непрерывная среда? Объединение живёт в
              обоих шейдерах, поэтому сливается и маска, и преломление.
            </Text>
            <View style={styles.wrap}>
              <Chip label="включить" on={morphOn} onPress={() => setMorphOn((v) => !v)} />
            </View>
            {morphOn ? (
              <Slider label="сближение" value={morphT} min={0} max={1} onChange={setMorphT} />
            ) : null}

            <Text style={styles.section}>параметры материала</Text>
            {/* Значение берётся из базового материала, а не из применённого: при выключенном
                тумблере применённый обнулён, и ползунок отскакивал бы назад при каждой правке. */}
            {SLIDER_KEYS.map((key) => (
              <Slider
                key={key}
                label={key}
                value={base[key]}
                min={MATERIAL_RANGES[key][0]}
                max={MATERIAL_RANGES[key][1]}
                onChange={(v) => setParam(key, v)}
              />
            ))}

            <Text style={styles.note}>
              Платформа: {Platform.OS}, API {String(Platform.Version)}. Тумблер = обнуление
              параметра, а не другой вариант шейдера — сравнение идёт на одной программе.
            </Text>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1114' },
  stage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '18%',
    alignItems: 'center',
    gap: 22,
  },
  hud: {
    position: 'absolute',
    left: 16,
    color: '#5ecfc6',
    fontSize: 12,
    fontWeight: '600',
  },
  panelWrap: { position: 'absolute', left: 0, right: 0 },
  panelWrapFilled: { backgroundColor: '#0a0e11f2' },
  panelToggle: {
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginBottom: 6,
    backgroundColor: '#1b2328ee',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  panelToggleText: { color: '#e6ecef', fontSize: 12 },
  panel: { maxHeight: 340, backgroundColor: '#0a0e11f2' },
  panelContent: { padding: 12, gap: 8 },
  section: { color: '#5ecfc6', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 6 },
  note: { color: '#7f9099', fontSize: 10, lineHeight: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: '#1b2328',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipOn: { backgroundColor: '#14322f', borderColor: '#5ecfc6' },
  chipText: { color: '#b3c1c8', fontSize: 11 },
  chipTextOn: { color: '#e6ecef' },
  slider: { gap: 4 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { color: '#b3c1c8', fontSize: 11 },
  sliderValue: { color: '#5ecfc6', fontSize: 11, fontVariant: ['tabular-nums'] },
  trackHit: { height: 26, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#1b2328', overflow: 'hidden' },
  trackFill: { height: 4, backgroundColor: '#5ecfc6' },
  knob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e6ecef',
  },
});

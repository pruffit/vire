import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/backdrop';
import { VireGlassSurface } from '../components/vireglass/glass-surface';
import { MaterialLabScene, ZONE_NAMES } from './material-lab-scene';
import { REFERENCE_SCENES } from '@vire/vireglass';
import {
  LabMiniPlayer,
  LabSheet,
  LabTabBar,
  LabTransport,
  type LabSurfaceProps,
} from './material-lab-elements';
import { MINI_PLAYER_HEIGHT, PLAYER_TRANSPORT_HEIGHT, TAB_BAR_CONTENT_HEIGHT } from '../lib/layout';
import { morphBetween, type VireGlassMorph } from '../lib/vireglass/adapters';
import { useFrameThrottle } from '../lib/frame-throttle';
import { INK_DARK, INK_LIGHT, useGlassAdaptation } from '../lib/vireglass/adaptation';
import { useEnvironmentLight } from '../lib/vireglass/environment';
import { REFERENCE_SHAPES } from '@vire/vireglass';
import {
  bevelDp,
  capsuleGeometry,
  circleGeometry,
  halfMinDp,
  roundedRectGeometry,
  type VireGlassGeometry,
} from '../lib/vireglass/geometry';
import {
  ALL_EFFECTS_ON,
  applyToggles,
  DEBUG_MODES,
  EFFECTS,
  LEGACY_NAMES,
  LEGACY_OPTICS,
  MATERIAL_PRESETS,
  MATERIAL_RANGES,
  PRESET_NAMES,
  resolveMaterial,
  resolveOptics,
  VIREGLASS_MATERIAL,
  type LegacyOpticsName,
  type MaterialPresetName,
  type VireGlassDebugMode,
  type VireGlassMaterial,
  type VireGlassNumericKey,
  type VireGlassOptics,
  type VireGlassToggles,
} from '../lib/vireglass/material';

// Стенд материала VireGlass. В продовый UI не входит: EXPO_PUBLIC_GLASS_LAB=material (App.tsx).
// Журнал экспериментов — docs/vireglass/material-lab.md.

// Фигуры общие с веб-стендом: размер входит в оптику через sizeGain, и на разных фигурах
// снимки двух стендов несравнимы (packages/vireglass/src/reference-scene.ts).
const SHAPES = REFERENCE_SHAPES;

type ShapeName = keyof typeof SHAPES;
const SHAPE_NAMES = Object.keys(SHAPES) as ShapeName[];

// Сцена: абстрактные фигуры или настоящие поверхности продукта на своих местах.
/**
 * Делитель метки состояния: индексы уезжают в снимок СЕРЫМ, и делитель обязан покрывать самый
 * длинный из списков. Стояло 16 при четырнадцати зонах; когда сверочных полотен стало восемь,
 * зоны с 16-й кодировались одним и тем же серым, и скрипт замера читал их все как шестнадцатую.
 */
const STATE_SCALE = 32;

const STAGES = ['фигуры', 'транспорт', 'мини-плеер', 'таб-бар', 'лист', 'всё вместе'] as const;
type StageName = (typeof STAGES)[number];

const SCREEN_H = Dimensions.get('window').height;
/** Экранная высота, куда сцена паркует выбранную зону. Совпадает с центром судимой
 *  поверхности: фигуры стоят на 18% сверху, продуктовые — над системной навигацией. */
const FIGURES_TOP = SCREEN_H * 0.18;

const SLIDER_KEYS = Object.keys(MATERIAL_RANGES) as VireGlassNumericKey[];

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Что компенсация размера реально выдаёт каждой поверхности продукта. */
const COMPENSATED: { label: string; geometry: VireGlassGeometry }[] = [
  { label: 'кнопка 68', geometry: circleGeometry(68) },
  { label: 'мини-плеер', geometry: roundedRectGeometry(369, 64, 24) },
  { label: 'транспорт', geometry: roundedRectGeometry(353, 72, 36) },
  { label: 'лист', geometry: roundedRectGeometry(393, 460, 30) },
];

/** Одна и та же среда на разных деталях: доля оптики растёт сама, без множителей. */
function compensationTable(o: VireGlassOptics): string {
  return COMPENSATED.map(({ label, geometry }) => {
    const half = halfMinDp(geometry);
    const bevel = bevelDp(geometry, o);
    const share = ((bevel / half) * 100).toFixed(0);
    return `${label.padEnd(11)} полураз ${half.toFixed(0).padStart(3)}  фаска ${bevel.toFixed(1)} (${share}%)`;
  }).join('\n');
}

function materialLiteral(m: VireGlassMaterial): string {
  const lines = SLIDER_KEYS.map((k) => `  ${k}: ${r2(m[k])},`);
  return `{\n${lines.join('\n')}\n}`;
}

/** Что из причин вывелось. Стенд обязан показывать и следствия — иначе связь не увидеть. */
function opticsTable(o: VireGlassOptics): string {
  return [
    `преломление  ${r2(o.refraction)}   увеличение ${r2(o.refractionScale)}`,
    `френель      ${r2(o.fresnel)}   показатель ${r2(o.fresnelPower)}`,
    `блик         ${r2(o.specular)}   узость     ${r2(o.specularPower)}`,
    `дисперсия    ${r2(o.dispersion)}   мутность   ${r2(o.blur)}`,
    `тинт         ${r2(o.tintStrength)}   у кромки  ×${r2(o.edgeDensity)}`,
  ].join('\n');
}

/** Стенд показывает либо выведенную из материала оптику, либо замороженный снимок старой
 *  модели — второе в причины не переводится, поэтому идёт мимо resolveOptics. */
function base0Optics(
  legacy: LegacyOpticsName | null,
  base: VireGlassMaterial,
  toggles: VireGlassToggles,
): VireGlassOptics {
  return applyToggles(legacy ? LEGACY_OPTICS[legacy] : resolveOptics(base), toggles);
}

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

/** Серый той светлоты, что кодирует величину 0…1. Крайние значения не берём: чистый чёрный
 *  и чистый белый встречаются в самой сцене, а метка обязана отличаться от неё. */
const grey = (v: number) => {
  const g = Math.round(16 + Math.max(0, Math.min(1, v)) * 220);
  return `rgb(${g}, ${g}, ${g})`;
};

function Stepper({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={onPrev} hitSlop={8}>
        <Text style={styles.stepBtnText}>{'◀'}</Text>
      </Pressable>
      <Text style={styles.stepLabel} numberOfLines={1}>{label}</Text>
      <Pressable style={styles.stepBtn} onPress={onNext} hitSlop={8}>
        <Text style={styles.stepBtnText}>{'▶'}</Text>
      </Pressable>
    </View>
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
  // Значение отдаётся раз в кадр: без этого каждое событие Pan тянуло за собой отдельный
  // рендер стенда, и ползунок ехал ступенями.
  const emit = useFrameThrottle(onChange);
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
          if (width > 0) emit(min + ((max - min) * Math.min(Math.max(e.x, 0), width)) / width);
        })
        .onChange((e) => {
          if (width > 0) emit(min + ((max - min) * Math.min(Math.max(e.x, 0), width)) / width);
        }),
    [width, min, max, emit],
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

  const [preset, setPreset] = useState<MaterialPresetName>('water');
  const [legacy, setLegacy] = useState<LegacyOpticsName | null>(null);
  const [base, setBase] = useState<VireGlassMaterial>(VIREGLASS_MATERIAL);
  const [toggles, setToggles] = useState<VireGlassToggles>(ALL_EFFECTS_ON);
  const [debug, setDebug] = useState<VireGlassDebugMode>('normal');
  const [shape, setShape] = useState<ShapeName>('круг');
  const [count, setCount] = useState(1);
  const [moving, setMoving] = useState(false);
  const [zone, setZone] = useState(0);
  const [morphOn, setMorphOn] = useState(false);
  const [morphT, setMorphT] = useState(0);
  const [lit, setLit] = useState(false);
  const [panel, setPanel] = useState(true);
  const [stage, setStage] = useState<StageName>('фигуры');
  const [dim, setDim] = useState(0);
  const [autoInk, setAutoInk] = useState(true);

  // Полярность надписи ведёт себя как в продукте: её выбирает автоматика по замеру фона
  // из нативного зонда. Ползунок ink остаётся ручным управлением, когда автоматика снята.
  const manual = useMemo(() => base0Optics(legacy, base, toggles), [legacy, base, toggles]);
  const adaptation = useGlassAdaptation(manual, { enabled: autoInk });
  const optics = useMemo(
    () => (autoInk ? { ...manual, ink: adaptation.ink } : manual),
    [manual, autoInk, adaptation.ink],
  );
  const geometry = SHAPES[shape];
  // На сверочных полотнах кадр обязан совпадать с кадром веб-стенда целиком: деталь в кадре
  // одна, без принадлежностей лаборатории.
  const onReferenceScene = REFERENCE_SCENES.some((s) => s.name === ZONE_NAMES[zone]);
  const focusY =
    stage === 'фигуры' ? FIGURES_TOP + geometry.height / 2 : SCREEN_H - insets.bottom - 110;

  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const press = useSharedValue(0);
  const active = useSharedValue(0);
  const light = useEnvironmentLight(optics.environment);
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

  // Стенд управляется ИЗВНЕ по диплинку:
  //   adb shell am start -a android.intent.action.VIEW -d "vire://lab?zone=11&preset=2"
  // Тапами это делать нельзя: `input tap` приходит с опозданием и иногда теряется, а замер,
  // сделанный не в том состоянии, — ровно та ошибка, из-за которой пришлось выбросить ночь
  // выводов (material-lab.md E-27). Ползунки и чипы остаются для работы руками.
  useEffect(() => {
    const apply = (url: string | null) => {
      if (!url || !url.includes('lab')) return;
      const q = new URLSearchParams(url.split('?')[1] ?? '');
      const num = (key: string) => {
        const v = q.get(key);
        return v === null ? null : Number(v);
      };
      const moveAt = num('move');
      if (moveAt !== null) setMoving(moveAt > 0);
      const zoneAt = num('zone');
      if (zoneAt !== null) {
        setMoving(false);
        setZone(Math.max(0, Math.min(ZONE_NAMES.length - 1, zoneAt)));
      }
      // Сеттеры, а не applyPreset: тот объявлен НИЖЕ этого эффекта, и обращение к нему из
      // колбэка Linking рвалось молча — всё, что стоит после, просто не применялось.
      const presetAt = num('preset');
      const presetName = presetAt === null ? undefined : PRESET_NAMES[presetAt];
      if (presetName) {
        setPreset(presetName);
        setLegacy(null);
        setBase(MATERIAL_PRESETS[presetName]);
      }
      const debugAt = num('debug');
      if (debugAt !== null && DEBUG_MODES[debugAt]) setDebug(DEBUG_MODES[debugAt]);
      const stageAt = num('stage');
      if (stageAt !== null && STAGES[stageAt]) setStage(STAGES[stageAt]);
      const panelAt = num('panel');
      if (panelAt !== null) setPanel(panelAt > 0);
      const autoAt = num('auto');
      if (autoAt !== null) setAutoInk(autoAt > 0);
      const morphAt = num('morph');
      if (morphAt !== null) {
        setMorphOn(morphAt > 0);
        setMorphT(Math.max(0, Math.min(1, morphAt)));
      }
      const shapeAt = num('shape');
      if (shapeAt !== null && SHAPE_NAMES[shapeAt]) setShape(SHAPE_NAMES[shapeAt]);
      const countAt = num('count');
      if (countAt !== null) setCount(Math.max(1, Math.min(6, countAt)));
      // Любой параметр материала — тем же ключом, что в модели: ?ior=1.7&film=620
      const patch: Partial<VireGlassMaterial> = {};
      for (const key of SLIDER_KEYS) {
        const v = num(key);
        if (v !== null) patch[key] = v;
      }
      if (Object.keys(patch).length > 0) {
        setLegacy(null);
        setBase((m) => resolveMaterial({ ...m, ...patch }));
      }
    };
    Linking.getInitialURL().then(apply);
    const sub = Linking.addEventListener('url', ({ url }) => apply(url));
    return () => sub.remove();
  }, []);

  const applyPreset = (name: MaterialPresetName) => {
    setPreset(name);
    setLegacy(null);
    setBase(MATERIAL_PRESETS[name]);
  };

  const setParam = (key: VireGlassNumericKey, v: number) => {
    const patch = { [key]: v } as Partial<VireGlassMaterial>;
    setBase((m) => resolveMaterial({ ...m, ...patch }));
  };

  const surfaces = morphOn ? [0] : Array.from({ length: count }, (_, i) => i);

  const surfaceProps = { optics, debug, blurTarget: targetRef, dim };
  const productStack: readonly StageName[] =
    stage === 'всё вместе'
      ? ['транспорт', 'мини-плеер', 'таб-бар']
      : stage === 'транспорт' || stage === 'мини-плеер' || stage === 'таб-бар'
        ? [stage]
        : [];

  return (
    <View style={styles.root}>
      {/* Цель блюра оборачивает ТОЛЬКО фон. Стекло внутри своей же цели замыкает дерево
          RenderNode и роняет рантайм переполнением стека в prepareTreeImpl. */}
      <Backdrop style={StyleSheet.absoluteFill} targetRef={targetRef}>
        <MaterialLabScene zone={zone} focusY={focusY} moving={moving} />
      </Backdrop>

      {stage === 'фигуры' ? (
        <View style={styles.stage} pointerEvents="none">
          {surfaces.map((i) => (
            <VireGlassSurface
              key={i}
              geometry={geometry}
              optics={optics}
              dynamics={{ shiftX, shiftY, press, active, light }}
              debug={debug}
              morph={morph}
              backdrop={toggles.backdrop}
              blurTarget={targetRef}
              onBackdropSample={i === 0 ? adaptation.onBackdropSample : undefined}
            />
          ))}
          {/* Надпись ПОВЕРХ стекла: ровно то, ради чего вся адаптация и существует. Её цвет
              ведёт автоматика — если стекло дошло до предела, полярность переворачивается.
              На сверочных полотнах её нет: там кадр обязан совпасть с кадром веб-стенда, а
              надпись — принадлежность лаборатории, а не материала. */}
          {onReferenceScene ? null : <Text
            style={[
              styles.overInk,
              {
                top: geometry.height / 2 - 9,
                color: `rgb(${Math.round(255 * (INK_DARK + (INK_LIGHT - INK_DARK) * optics.ink))}, ${Math.round(255 * (INK_DARK + (INK_LIGHT - INK_DARK) * optics.ink))}, ${Math.round(255 * (INK_DARK + (INK_LIGHT - INK_DARK) * optics.ink))})`,
              },
            ]}
          >
            Читаемость
          </Text>}
        </View>
      ) : null}

      {/* Продуктовые поверхности стоят там же, где в приложении: судить материал имеет смысл
          только на настоящей высоте над настоящим фоном. */}
      {stage === 'лист' ? <LabSheet {...surfaceProps} /> : null}
      {productStack.length > 0 ? (
        <View style={[styles.productStack, { bottom: insets.bottom + 6 }]} pointerEvents="box-none">
          {productStack.includes('транспорт') ? <LabTransport {...surfaceProps} /> : null}
          {productStack.includes('мини-плеер') ? <LabMiniPlayer {...surfaceProps} /> : null}
          {productStack.includes('таб-бар') ? <LabTabBar {...surfaceProps} /> : null}
        </View>
      ) : null}

      {/* Строка стоит НЕПОДВИЖНО и вне прокрутки: повторный замер требует, чтобы состояние
          менялось по фиксированным координатам, иначе тап уезжает в соседний чип (E-27). */}
      <View style={[styles.steppers, { top: insets.top + 4 }]} pointerEvents="box-none">
        <Stepper
          label={moving ? 'движение' : ZONE_NAMES[zone]}
          onPrev={() => { setMoving(false); setZone((z) => (z + ZONE_NAMES.length - 1) % ZONE_NAMES.length); }}
          onNext={() => { setMoving(false); setZone((z) => (z + 1) % ZONE_NAMES.length); }}
        />
        <Stepper
          label={legacy ?? preset}
          onPrev={() => applyPreset(PRESET_NAMES[(PRESET_NAMES.indexOf(preset) + PRESET_NAMES.length - 1) % PRESET_NAMES.length])}
          onNext={() => applyPreset(PRESET_NAMES[(PRESET_NAMES.indexOf(preset) + 1) % PRESET_NAMES.length])}
        />
        <Stepper
          label={debug}
          onPrev={() => setDebug(DEBUG_MODES[(DEBUG_MODES.indexOf(debug) + DEBUG_MODES.length - 1) % DEBUG_MODES.length])}
          onNext={() => setDebug(DEBUG_MODES[(DEBUG_MODES.indexOf(debug) + 1) % DEBUG_MODES.length])}
        />
        <Stepper
          label={stage}
          onPrev={() => setStage(STAGES[(STAGES.indexOf(stage) + STAGES.length - 1) % STAGES.length])}
          onNext={() => setStage(STAGES[(STAGES.indexOf(stage) + 1) % STAGES.length])}
        />
      </View>

      {/* Панель уезжает наверх, когда мешает снизу: лист выезжает ровно оттуда же, а
          свёрнутая кнопка иначе ложится на таб-бар и мини-плеер, которые и оцениваются. */}
      <View
        style={[
          styles.panelWrap,
          panel && styles.panelWrapFilled,
          stage === 'лист' || !panel
            ? { top: 0, paddingTop: insets.top + 8 }
            : { bottom: 0, paddingBottom: insets.bottom + 8 },
        ]}
      >
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

            <Text style={styles.section}>старая модель</Text>
            <View style={styles.wrap}>
              {LEGACY_NAMES.map((n) => (
                <Chip
                  key={n}
                  label={n}
                  on={legacy === n}
                  onPress={() => setLegacy(legacy === n ? null : n)}
                />
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

            <Text style={styles.section}>поверхность</Text>
            <View style={styles.wrap}>
              {STAGES.map((s) => (
                <Chip key={s} label={s} on={stage === s} onPress={() => setStage(s)} />
              ))}
            </View>
            <Slider label="dim (затемнение линзы)" value={dim} min={0} max={1} onChange={setDim} />
            <View style={styles.wrap}>
              <Chip label="автополярность" on={autoInk} onPress={() => setAutoInk((v) => !v)} />
            </View>
            <Text style={styles.code} selectable>
              {adaptation.sample
                ? `фон ${adaptation.sample.luma.toFixed(3)}  пестрота ${adaptation.sample.busy.toFixed(3)}
полярность ${optics.ink.toFixed(2)}`
                : 'зонд молчит'}
            </Text>

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

            <Text style={styles.section}>зона под стеклом</Text>
            <View style={styles.wrap}>
              {ZONE_NAMES.map((n, i) => (
                <Chip key={n} label={n} on={!moving && zone === i} onPress={() => { setMoving(false); setZone(i); }} />
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

            {/* Настроенное надо уметь вынести из стенда: снимок этого блока — готовый
                литерал для lib/vireglass/material.ts. */}
            <Text style={styles.section}>компенсация размера</Text>
            <Text style={styles.code} selectable>
              {compensationTable(optics)}
            </Text>

            <Text style={styles.section}>следствия</Text>
            <Text style={styles.code} selectable>
              {opticsTable(optics)}
            </Text>

            <Text style={styles.section}>значения</Text>
            <Text style={styles.code} selectable>
              {materialLiteral(base)}
            </Text>

            <Text style={styles.note}>
              Платформа: {Platform.OS}, API {String(Platform.Version)}. Тумблер = обнуление
              параметра, а не другой вариант шейдера — сравнение идёт на одной программе.
            </Text>
          </ScrollView>
        ) : null}
      </View>
      {/* Метка состояния для скриптов замера (scripts/glass-probe.mjs). Слева маркер
          фиксированного цвета — по нему скрипт находит метку на снимке, не зная ни плотности
          экрана, ни вырезов. Дальше данные, каждое СЕРЫМ: экран телефона гонит скриншот через
          цветовой профиль, и насыщенные цвета приезжают искажёнными (маджента как 234,51,247),
          а серые проходят один в один. */}
      <View style={styles.stateTag} pointerEvents="none">
        <View style={styles.stateMark} />
        {[
          zone / STATE_SCALE,
          PRESET_NAMES.indexOf(preset) / STATE_SCALE,
          DEBUG_MODES.indexOf(debug) / STATE_SCALE,
          optics.ink,
          adaptation.sample?.luma ?? 0,
          Math.min(adaptation.sample?.busy ?? 0, 1),
        ].map((v, i) => (
          <View
            key={i}
            style={[styles.stateCell, { backgroundColor: grey(v) }]}
          />
        ))}
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
  productStack: { position: 'absolute', left: 0, right: 0, gap: 10 },
  overInk: { position: 'absolute', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  code: {
    color: '#b3c1c8',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    backgroundColor: '#12181c',
    borderRadius: 6,
    padding: 8,
  },
  stateTag: { position: 'absolute', left: 0, top: 96, flexDirection: 'row' },
  stateMark: { width: 12, height: 12, backgroundColor: '#ff00ff' },
  stateCell: { width: 12, height: 12 },
  steppers: { position: 'absolute', left: 8, right: 8, flexDirection: 'row', gap: 6 },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0e11d8',
    borderRadius: 7,
    paddingVertical: 3,
  },
  stepBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  stepBtnText: { color: '#5ecfc6', fontSize: 12 },
  stepLabel: { flex: 1, color: '#e6ecef', fontSize: 9, textAlign: 'center' },
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

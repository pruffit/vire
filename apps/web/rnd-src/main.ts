// Стенд VireGlass — не React-страница (план, «Среда»/«Следствие для стенда»): статический
// HTML + этот бандл, esbuild собирает его за миллисекунды из `packages/vireglass`.
// Состояние целиком в адресе: ссылка воспроизводит кадр, как диплинк на Android-стенде.
import {
  applyAccessibility,
  DEBUG_MODES,
  INK_DARK,
  INK_LIGHT,
  MATERIAL_PRESETS,
  MATERIAL_RANGES,
  PRESET_NAMES,
  REST_LIGHT,
  resolveOptics,
  type VireGlassAccessibility,
  roundedRectGeometry,
  circleGeometry,
  VIREGLASS_CLEAR_MATERIAL,
  VIREGLASS_CONTROL_MATERIAL,
  VIREGLASS_MATERIAL,
  activeMaterial,
  createDeform,
  materialForInk,
  raiseIntoGlass,
  type VireGlassDebugMode,
  type VireGlassMaterial,
  type VireGlassNumericKey,
  halfMinDp,
  shouldInkBeLight,
} from 'vireglass';
import {
  MEDIUM_DEFAULT_CELL_PX,
  MEDIUM_DEFAULTS,
  MEDIUM_SPECIES_LIGHTNESS,
  createMediumDynamics,
  lightRigForCharacter,
  type VireUIKitMediumPlaybackState,
} from 'vireuikit';
import {
  REFERENCE_PIECE_AT,
  REFERENCE_SCENES,
  REFERENCE_SCENE_HEIGHT,
  REFERENCE_SCENE_WIDTH,
  REFERENCE_SHAPES,
} from '@vire/vireglass';
import { createVireGlassRenderer } from 'vireglass/web';
import { createMediumBackdrop } from 'vireuikit/web';
import { drawIcon, loadIcons, NAV_ICONS, type IconName } from './icons';
import { drawCover, drawPlayerInk, hitPlay, PLAYER_ICONS } from './mini-player';
import { createPanel } from './panel';
import { createGroup } from './group';
import { CAPSULE, createPopover, POPOVER_ICONS, type PopoverHit } from './popover';
import {
  drawCoverScreen,
  drawFlowInk,
  drawRecentScreen,
  FLOW_BUTTON,
  recentScrollMax,
  SCREEN_INNER_RADIUS,
  TOP_BAR_Y,
  TRANSPORT_ICONS,
} from './content';
import { drawTypeSpecimen, loadTypefaces, typeScrollMax } from './typefaces';
import {
  drawAppBackground,
  drawFoot,
  drawPhoneFrames,
  PHONE,
  phoneOrigin,
  SCREEN_MARGIN,
  ZONES,
  ZONE_NAMES,
} from './scenes';

/**
 * Сверочные полотна. На них кадр обязан совпадать с кадром мобильной лаборатории целиком, а не
 * только полотном: деталь стоит в точке, заданной полотном, и в кадре она ОДНА — ряд образцов
 * материалов и подписи под ними ложились прямо на полотно, а на телефоне их нет.
 */
const REFERENCE_ZONE_NAMES = new Set(REFERENCE_SCENES.map((s) => s.name));
const onReferenceScene = () => REFERENCE_ZONE_NAMES.has(ZONE_NAMES[state.zone]);

/** Зона среды (`medium`, второй путь подложки, см. `scenes.ts`) — свой GPU-проход вместо
 *  2D-канваса, поэтому и сцена, и цикл кадра ведут её отдельной веткой. */
const onMediumZone = () => ZONE_NAMES[state.zone] === 'среда';

const stage = document.getElementById('stage');
if (!stage) throw new Error('нет #stage');

const canvas = document.createElement('canvas');
stage.append(canvas);

// Слой матовой крышки ползунка: обычный 2D-канвас ПОВЕРХ кадра. В полотне её увидел бы зонд и
// принял за окружение; указатель сквозь слой проходит, жест ловит нижний канвас.
const solidLayer = document.createElement('canvas');
solidLayer.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
stage.append(solidLayer);
const solidCtx = solidLayer.getContext('2d');

// Цветной контент (обложка) уезжает в рендерер отдельным СЛОЕМ КАДРА, а не рисуется поверх
// канваса: он обязан жить внутри материала на той же координате, что и краска, иначе
// деформация ведёт их порознь.
const overlay = document.createElement('canvas');
const overlayCtx = overlay.getContext('2d');

const params = new URLSearchParams(location.search);
const MATERIAL_KEYS = Object.keys(MATERIAL_RANGES) as VireGlassNumericKey[];

function intParam(name: string, fallback: number, min: number, max: number): number {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const v = Math.round(Number(raw));
  return Number.isFinite(v) ? Math.min(Math.max(v, min), max) : fallback;
}

/** Зона в адресе — номером ИЛИ именем: у двух стендов номера разные, а имя полотна одно, и
 *  ссылка на сверку не должна знать, сколько своих зон у каждого. */
function zoneParam(): number {
  const raw = params.get('zone');
  if (raw === null) return 0;
  const byName = ZONE_NAMES.indexOf(raw);
  if (byName >= 0) return byName;
  return intParam('zone', 0, 0, ZONES.length - 1);
}

/** Число стёкол харнесса замера (`?glass=0|1|3|6`) — заданное явно, заменяет обычные детали
 *  вида на N квадратов независимо от зоны: `docs/vireglass/benchmarks/2026-09-14-medium-cost.md`. */
const glassCountParam = params.get('glass');
const glassCount =
  glassCountParam === null ? null : Math.max(0, Math.min(6, Math.round(Number(glassCountParam)) || 0));

/** В обычном режиме рендер не вызывается на устаканившемся кадре — бенчмарку нужен каждый rAF,
 *  иначе мерить время кадра нечем. */
const benchMode = params.get('bench') === '1';

/** device-px на ячейку сетки симуляции — свой параметр замера (спека фона: разрешение сетки
 *  считается и меряется отдельно от разрешения кадра). */
const gridCellPx = intParam('gridCell', MEDIUM_DEFAULT_CELL_PX, 4, 128);

/** Переключатель состояния «Покоя» (спека фона) — в стенде адресом, ссылки на диплинк как на
 *  Android достаточно, отдельный UI не нужен. */
const MEDIUM_STATES: readonly VireUIKitMediumPlaybackState[] = ['idle', 'playing', 'paused', 'stopped'];
function mediumStateParam(): VireUIKitMediumPlaybackState {
  const raw = params.get('playback');
  // По умолчанию стенд показывает НАЧАЛЬНОЕ состояние (спека): обложки нет, источника нет.
  return (MEDIUM_STATES as readonly string[]).includes(raw ?? '')
    ? (raw as VireUIKitMediumPlaybackState)
    : 'idle';
}
const mediumPlaybackState = mediumStateParam();
const mediumBpm = intParam('bpm', 128, 40, 220);
/** Фиксированная точка «обложки» (спека: «в стенде — фиксированная точка обложки»); палитра
 *  обложки — следующий срез, здесь важно только откуда идёт эмиссия. */
const MEDIUM_SOURCE_POINT: readonly [number, number] = [0.5, 0.5];
/** `?amp=` фиксирует амплитуду для воспроизводимого замера (бенчмарк, гейт мигания); без
 *  параметра — синтетическая плавная огибающая (спека: «подай синтетическую огибающую»). */
const mediumAmpOverride = params.has('amp') ? Number(params.get('amp')) : null;
function syntheticAmplitude(t: number): number {
  if (mediumAmpOverride !== null && Number.isFinite(mediumAmpOverride)) {
    return Math.max(0, Math.min(1, mediumAmpOverride));
  }
  return 0.5 + 0.5 * Math.sin(t * 0.5);
}
/** `?advectSpeed=` — контрольный прогон гейта структуры на другой скорости течения: калибровка
 *  порога в `docs/vireglass/benchmarks/2026-09-14-medium-cost.md`. */
const mediumAdvectSpeedOverride = params.has('advectSpeed') ? Number(params.get('advectSpeed')) : null;
/** `?m.<параметр>=<число>` — любой числовой параметр среды поверх дефолтов, чтобы разбирать вид
 *  по механизмам, не пересобирая пакет. */
const mediumParamOverrides: Record<string, number> = Object.fromEntries(
  [...params]
    .filter(([key]) => key.startsWith('m.'))
    .filter(([key, value]) => {
      const known = typeof (MEDIUM_DEFAULTS as Record<string, unknown>)[key.slice(2)] === 'number';
      if (!known || !Number.isFinite(Number(value))) console.warn(`стенд: параметр среды ${key}=${value} пропущен`);
      return known && Number.isFinite(Number(value));
    })
    .map(([key, value]) => [key.slice(2), Number(value)]),
);
/** `?cover=<тон>[,<цветность>]` — характер обложки вместо начальной нейтрали: стенду нужно
 *  чем-то показать цветную семью, пока палитру не считает сервер (спека «Палитра обложки»). Цвет
 *  идёт на СВЕТ (`lightRigForCharacter`), не на `channelColors` — газ в камере невидим сам по
 *  себе, светится только то, что светильники освещают (см. `light-rig.ts`). */
const mediumCoverLights = (() => {
  const raw = params.get('cover');
  if (raw === null) return null;
  const [hue, chroma = 0.09] = raw.split(',').map(Number);
  if (!Number.isFinite(hue) || !Number.isFinite(chroma)) return null;
  return lightRigForCharacter({ hue, chroma, lightness: MEDIUM_SPECIES_LIGHTNESS });
})();
const mediumDynamics = createMediumDynamics();
/** Позиция трека — своя, растёт только пока `playback=playing` (детерминированно от неё же
 *  считается такт эмиссии, а не от часов стенда). */
let mediumPosition = 0;

const state = {
  zone: zoneParam(),
  preset: intParam('preset', -1, -1, PRESET_NAMES.length - 1),
  debug: intParam('debug', 0, 0, DEBUG_MODES.length - 1),
  view: params.get('view') === 'screens'
    ? ('screens' as const)
    : params.get('view') === 'morph'
      ? ('morph' as const)
      : params.get('view') === 'slider'
        ? ('slider' as const)
        : ('material' as const),
  overrides: new Map<VireGlassNumericKey, number>(),
};

for (const key of MATERIAL_KEYS) {
  const raw = params.get(key);
  if (raw === null) continue;
  const v = Number(raw);
  if (Number.isFinite(v)) state.overrides.set(key, v);
}

/** Прозрачный вариант (Clear) — отдельное состояние стенда: смешивать его с обычным нельзя,
 *  поэтому он не пресет среды, а режим кадра целиком. */
const clearMode = params.get('clear') === '1';

/**
 * Настройки доступности меняют слои материала, а не отменяют его (эталон 219 §18:15). Стенд
 * берёт их из системы, а буквы в адресе (?a11y=tcm) включают принудительно: перещёлкивать
 * настройки всей ОС ради одного кадра невозможно.
 */
const a11yForced = params.get('a11y') ?? '';
const asks = (query: string) => window.matchMedia?.(query).matches ?? false;
const a11y: VireGlassAccessibility = {
  reduceTransparency: a11yForced.includes('t') || asks('(prefers-reduced-transparency: reduce)'),
  increaseContrast: a11yForced.includes('c') || asks('(prefers-contrast: more)'),
  reduceMotion: a11yForced.includes('m') || asks('(prefers-reduced-motion: reduce)'),
};

/** Материал кадра всегда идёт через модификаторы: иначе часть деталей их не увидит. */
function optic(material: Partial<VireGlassMaterial> = {}) {
  return applyAccessibility(resolveOptics(material), a11y);
}

function baseMaterial(): VireGlassMaterial {
  if (clearMode) return VIREGLASS_CLEAR_MATERIAL;
  return state.preset >= 0 ? MATERIAL_PRESETS[PRESET_NAMES[state.preset]] : VIREGLASS_MATERIAL;
}

function currentMaterial(): VireGlassMaterial {
  const material = { ...baseMaterial() };
  for (const [key, value] of state.overrides) material[key] = value;
  return material;
}

// Полярность надписи решает ПРИЛОЖЕНИЕ, а не шейдер: когда цена удержания светлой надписи
// переваливает за предел, деталь перестаёт быть стеклом и становится крашеной плашкой.
// Явный `ink` в адресе — ручной режим, автоматика тогда молчит.
let manualInk = state.overrides.has('ink');
let material = currentMaterial();
let optics = optic(material);
let polarity = manualInk ? 'ручная' : 'светлая';

// Форма контрольного образца — в адресе: капсула и круг повторяют эталонные кадры.
// Фигуры общие с мобильной лабораторией: размер входит в оптику, и на разных фигурах снимки
// двух стендов несравнимы (packages/vireglass/src/reference-scene.ts). Общий у них и ПОРЯДОК:
// свои имена и своё «по умолчанию» на каждом стенде значили, что одно и то же `shape` в двух
// местах выбирает разные фигуры, и сверка снова разъезжалась.
const SHAPES = REFERENCE_SHAPES;
const SHAPE_NAMES = Object.keys(SHAPES) as (keyof typeof SHAPES)[];
// Прежние английские имена остаются рабочими: на них ссылаются снятые сверки в
// docs/vireglass/benchmarks/**, и молчаливый откат к первой фигуре сделал бы их кадры
// невоспроизводимыми — с виду успешно.
const LEGACY_SHAPES: Record<string, keyof typeof SHAPES> = {
  rect: 'плашка',
  capsule: 'капсула',
  circle: 'круг',
};
const shapeParam = params.get('shape') ?? '';
const shapeIndex = Number(shapeParam);
const shapeName = shapeParam !== '' && Number.isInteger(shapeIndex) && SHAPE_NAMES[shapeIndex]
  ? SHAPE_NAMES[shapeIndex]
  : SHAPE_NAMES.includes(shapeParam as keyof typeof SHAPES)
    ? (shapeParam as keyof typeof SHAPES)
    : (LEGACY_SHAPES[shapeParam] ?? SHAPE_NAMES[0]);
const geometry = SHAPES[shapeName];
const dpr = window.devicePixelRatio || 1;
const renderer = createVireGlassRenderer(canvas);
const medium = createMediumBackdrop();

function resize(): void {
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  solidLayer.width = canvas.width;
  solidLayer.height = canvas.height;
  renderer.resize(canvas.width, canvas.height);
}
resize();

/** Часы среды — свои, монотонные, не завязанные на «устаканился ли кадр» (ниже). */
let mediumTime = 0;
let lastDt = 0;
/** Последняя турбулентность и число впечатанных следов — только для метки на стенде. */
let mediumTurbulence = 0;
let mediumEmitCount = 0;

/** Сетка симуляции грубее кадра НАРОЧНО (спека фона: зонд материала не видит фактуру мельче
 *  своего пола) — ячейка в device-px, тот же порядок величины, что толщина линий сетки-зоны. */
function mediumGrid(): { width: number; height: number } {
  return {
    width: Math.max(2, Math.round(canvas.width / gridCellPx)),
    height: Math.max(2, Math.round(canvas.height / gridCellPx)),
  };
}

if (benchMode) {
  // Время между кадрами цикла rAF и, если доступен GPU-таймер, GPU-время того же кадра.
  (window as unknown as { __vgBenchSample: () => Promise<{ frames: number[]; gpu: (number | null)[] }> }).__vgBenchSample =
    () =>
      new Promise((resolve) => {
        const SAMPLES = 90;
        const frames: number[] = [];
        const gpu: (number | null)[] = [];
        let last = performance.now();
        function tick(t: number): void {
          frames.push(t - last);
          last = t;
          gpu.push(renderer.getLastGpuMs());
          if (frames.length < SAMPLES) requestAnimationFrame(tick);
          // Первый интервал меряет время ДО старта сэмплера, а не кадра — отбрасывается.
          else resolve({ frames: frames.slice(1), gpu: gpu.slice(1) });
        }
        requestAnimationFrame(tick);
      });

  // Покадровая (не усреднённая) светлота: только так виден баг «буфер переворачивается каждый
  // шаг» — гейт `medium-flicker-gate.mjs` сверяет знак приращения между кадрами.
  (window as unknown as { __vgLumaSample: () => Promise<number[]> }).__vgLumaSample = () =>
    new Promise((resolve) => {
      const lumaGl = canvas.getContext('webgl2') as WebGL2RenderingContext;
      const SAMPLES = 60;
      const size = Math.min(256, canvas.width, canvas.height);
      const x = Math.max(0, Math.floor((canvas.width - size) / 2));
      const y = Math.max(0, Math.floor((canvas.height - size) / 2));
      const buf = new Uint8Array(size * size * 4);
      const lumas: number[] = [];
      function sample(): number {
        lumaGl.readPixels(x, y, size, size, lumaGl.RGBA, lumaGl.UNSIGNED_BYTE, buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 4) {
          sum += 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
        }
        return sum / (buf.length / 4) / 255;
      }
      function tick(): void {
        lumas.push(sample());
        if (lumas.length < SAMPLES) requestAnimationFrame(tick);
        else resolve(lumas);
      }
      requestAnimationFrame(tick);
    });

  // Гейт равновесия плотности (`scripts/medium-equilibrium-gate.mjs`): светлота ВСЕГО кадра
  // одним снимком — вызывающий сам расставляет вызовы во времени, здесь нет своего таймера.
  (window as unknown as { __vgFrameLuma: () => number }).__vgFrameLuma = () => {
    const lumaGl = canvas.getContext('webgl2') as WebGL2RenderingContext;
    const buf = new Uint8Array(canvas.width * canvas.height * 4);
    lumaGl.readPixels(0, 0, canvas.width, canvas.height, lumaGl.RGBA, lumaGl.UNSIGNED_BYTE, buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i += 4) {
      sum += 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
    }
    return sum / (buf.length / 4) / 255;
  };

  // Сырые суммы фаз в обход композита — для гейта равновесия (`docs/vireglass/benchmarks/
  // 2026-09-14-medium-cost.md`). `null`, пока среда ни разу не рендерилась.
  (
    window as unknown as {
      __vgWaterTotals: () => { vapor: number; condensate: number; track: number } | null;
    }
  ).__vgWaterTotals = () => medium.readTotals();

  // Сырая сетка пара (r/g/b — три вида на ячейку, не сумма) — гейт структуры читает контраст
  // между видами: `docs/vireglass/benchmarks/2026-09-14-medium-cost.md`.
  (
    window as unknown as {
      __vgVaporGrid: () => { cols: number; rows: number; data: number[] } | null;
    }
  ).__vgVaporGrid = () => medium.readVaporGrid();
}

const label = document.createElement('div');
label.dataset.testid = 'rnd-state';
// Метка читается и человеком, и с кадра — на шахматке полупрозрачная подложка её топила.
label.style.cssText =
  'position:fixed;left:12px;top:12px;padding:6px 10px;border-radius:6px;background:#080a0ef2;' +
  'border:1px solid #ffffff1f;color:#e6ecf2;white-space:pre;';

// Ряд образцов: все восемь материалов рядом на одном фоне. Показываются КАК ЕСТЬ, без правок
// ползунками — иначе сравнивать нечего; настраиваемая деталь одна, крупная, над рядом.
const SAMPLE_MATERIALS: readonly { name: string; material: VireGlassMaterial }[] = [
  { name: 'база', material: VIREGLASS_MATERIAL },
  ...PRESET_NAMES.map((name) => ({ name, material: MATERIAL_PRESETS[name] })),
];

const panelShown = params.get('ui') !== '0';

const captions = SAMPLE_MATERIALS.map((sample) => {
  const node = document.createElement('div');
  node.textContent = sample.name;
  node.style.cssText =
    'position:fixed;transform:translateX(-50%);text-align:center;font:11px/1.2 system-ui,sans-serif;' +
    'color:#8b98a8;pointer-events:none;';
  document.body.append(node);
  return node;
});

const panel = !panelShown ? null : createPanel(
  { view: state.view, zone: state.zone, preset: state.preset, debug: state.debug, material },
  {
    onView: (view) => change(() => { state.view = view; }),
    onZone: (zone) => change(() => { state.zone = zone; }),
    onPreset: (preset) => change(() => { state.preset = preset; state.overrides.clear(); manualInk = false; }),
    onDebug: (debug) => change(() => { state.debug = debug; }),
    onMaterial: (key, value) => change(() => {
      state.overrides.set(key, value);
      if (key === 'ink') manualInk = true;
    }),
    onReset: () => change(() => { state.overrides.clear(); manualInk = false; }),
  },
  ZONE_NAMES,
);

// Зонд читает через PBO с отставанием в кадр-два (`probe.ts`), а полярность подтверждается
// уже по его выборке — после любой правки кадр досчитывается несколько раз, иначе замер
// останется от прошлого состояния.
const SETTLE_FRAMES = 16;
let pending = SETTLE_FRAMES;
let ready = false;

function change(mutate: () => void): void {
  mutate();
  material = currentMaterial();
  optics = optic(material);
  pending = SETTLE_FRAMES;
  ready = false;
  // Раскладка подписей зависит от режима, поэтому пересчитывается на ЛЮБОЕ изменение —
  // иначе про неё забывает тот обработчик, который её меняет.
  placeCaptions();
  syncUrl();
}

function syncUrl(): void {
  const next = new URLSearchParams();
  next.set('zone', String(state.zone));
  if (state.preset >= 0) next.set('preset', String(state.preset));
  if (state.debug > 0) next.set('debug', String(state.debug));
  if (state.view !== 'material') next.set('view', state.view);
  for (const [key, value] of state.overrides) next.set(key, String(Math.round(value * 1000) / 1000));
  if (params.get('ui') === '0') next.set('ui', '0');
  if (params.has('hue')) next.set('hue', String(accentHue));
  if (params.has('shape')) next.set('shape', shapeName);
  if (params.has('appear')) next.set('appear', String(appearTarget));
  if (params.has('accent')) next.set('accent', '1');
  if (params.has('playback')) next.set('playback', mediumPlaybackState);
  if (params.has('bpm')) next.set('bpm', String(mediumBpm));
  if (mediumAmpOverride !== null && Number.isFinite(mediumAmpOverride)) next.set('amp', String(mediumAmpOverride));
  for (const key of ['advectSpeed', 'cover', 'gridCell', 'glass', 'bench']) {
    const value = params.get(key);
    if (value !== null) next.set(key, value);
  }
  for (const [key, value] of Object.entries(mediumParamOverrides)) next.set(`m.${key}`, String(value));
  if (a11yForced) next.set('a11y', a11yForced);
  if (clearMode) next.set('clear', '1');
  history.replaceState(null, '', `${location.pathname}?${next}`);
}

/** Панель перекрывает правый край канваса — сцена шире того, что видно. Центрировать надо по
 *  видимой части, иначе и контрольный образец, и ряд уезжают под панель. */
function viewWidthCss(): number {
  const panelWidth = panelShown ? 316 + 24 : 0;
  return canvas.width / dpr - panelWidth;
}

// Детали НЕПОДВИЖНЫ, ползёт полотно под ними: исследуют преломление, а не прокручивают
// страницу. Двигать линзы вместе с фоном бессмысленно — картина под деталью тогда не меняется.
const offset = { x: 0, y: 0 };

function sampleLayout() {
  const gap = 12;
  const margin = 24;
  const count = SAMPLE_MATERIALS.length;
  const size = Math.min(84, (viewWidthCss() - margin * 2 - gap * (count - 1)) / count);
  const total = size * count + gap * (count - 1);
  const left = (viewWidthCss() - total) / 2 + size / 2;
  return { size, gap, left, y: canvas.height * 0.66 };
}

function samplePieces(ink: number) {
  const { size, gap, left, y } = sampleLayout();
  return SAMPLE_MATERIALS.map((sample, i) => ({
    optics: optic({ ...sample.material, ink }),
    geometry: roundedRectGeometry(size, size, size * 0.28),
    centerX: (left + i * (size + gap)) * dpr,
    centerY: y,
    light: lightFor((left + i * (size + gap)) * dpr, y),
  }));
}

/** N одинаковых стёкол в ряд, общих для любой зоны — харнесс замера стоимости среды
 *  (`docs/vireglass/benchmarks/2026-09-14-medium-cost.md`). */
function glassPieces(count: number) {
  if (count <= 0) return [];
  const size = 132;
  const gap = 20;
  const total = size * count + gap * (count - 1);
  const left = (viewWidthCss() - total) / 2 + size / 2;
  const y = canvas.height * 0.5;
  return Array.from({ length: count }, (_, i) => ({
    optics: optic(currentMaterial()),
    geometry: roundedRectGeometry(size, size, size * 0.28),
    centerX: (left + i * (size + gap)) * dpr,
    centerY: y,
    light: lightFor((left + i * (size + gap)) * dpr, y),
    appear: 1,
  }));
}

/** Подписи живут в DOM, а не в сцене: нарисованные в сцену, они попали бы ПОД стекло. */
function placeCaptions(): void {
  const { size, gap, left, y } = sampleLayout();
  const hidden = state.view !== 'material' || onReferenceScene();
  captions.forEach((node, i) => {
    node.style.display = hidden ? 'none' : 'block';
    node.style.left = `${left + i * (size + gap)}px`;
    node.style.top = `${y / dpr + size / 2 + 10}px`;
    node.style.width = `${size + gap}px`;
  });
}

// Волна от касания заметнее, чем от отрыва: палец ударяет по поверхности, отпускание её
// только отпускает. Амплитуды в CSS-пикселях смещения поля.
const WAVE_ON_TOUCH = a11y.reduceMotion ? 0 : 4;
const WAVE_ON_RELEASE = a11y.reduceMotion ? 0 : 2.5;

const deform = createDeform();

// На сверочном полотне деталь стоит В ТОЧКЕ, ЗАДАННОЙ ПОЛОТНОМ, и отсчитывается от панели, а
// не от видимой области: с открытой панелью управления центр видимой области и центр полотна —
// разные точки, и деталь оказывалась над другими полосами, чем в мобильной лаборатории.
const controlCenter = () => {
  if (!onReferenceScene()) {
    return { x: (viewWidthCss() / 2) * dpr, y: canvas.height * 0.34 };
  }
  const left = (canvas.width - REFERENCE_SCENE_WIDTH * dpr) / 2;
  const top = (canvas.height - REFERENCE_SCENE_HEIGHT * dpr) / 2;
  return { x: left + REFERENCE_PIECE_AT.xDp * dpr, y: top + REFERENCE_PIECE_AT.yDp * dpr };
};
// Ход тяги умеренный: тянут пальцем, а не растягивают резину. Деформация локальная, поэтому
// заметна и при небольшой амплитуде — прежние 0.7 полуразмера читались как «слишком много».
const pullLimit = () => 0.14 * halfMinDp(geometry);
/** Радиус влияния пальца: за его пределами поле стоит на месте. */
const touchRadius = () => 0.72 * halfMinDp(geometry);

/** Свет за указателем — веб-замена наклона устройства (M 11:29): блик тянется к нему. */
let pointer: { x: number; y: number } | null = null;
const POINTER_PULL = 0.7;

function lightFor(cx: number, cy: number): readonly [number, number] {
  if (!pointer) return REST_LIGHT;
  const dx = pointer.x * dpr - cx;
  const dy = pointer.y * dpr - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1) return REST_LIGHT;
  const x = REST_LIGHT[0] * (1 - POINTER_PULL) + (dx / len) * POINTER_PULL;
  const y = REST_LIGHT[1] * (1 - POINTER_PULL) + (dy / len) * POINTER_PULL;
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** Появление — нарастанием линзы, а не прозрачностью (M 2:55): двойной клик по образцу. */
const appearParam = Number(params.get('appear') ?? 1);
let appearTarget = Number.isFinite(appearParam) ? Math.min(Math.max(appearParam, 0), 1) : 1;
let appear = appearTarget;

function stepAppear(dt: number): boolean {
  if (a11y.reduceMotion) {
    const moved = appear !== appearTarget;
    appear = appearTarget;
    return moved;
  }
  if (Math.abs(appearTarget - appear) < 0.002) {
    appear = appearTarget;
    return false;
  }
  appear += (appearTarget - appear) * (1 - Math.exp(-dt / 0.14));
  return true;
}

/**
 * Габарит детали НЕ трогается: тяга, нажатие и волна уходят в поле формы (`vgTouchWarp`).
 * Масштабирование ширины давало абсурд — тянешь правый край, а левый уходит наружу.
 *
 * Материал берётся КАК ЕСТЬ, мимо `materialForInk`: это лаборатория среды. Замеряя по этой
 * детали, задавай читаемость в адресе явно — умолчание тут своё, не продуктовое.
 */
function controlPiece() {
  const d = deform.sample();
  const center = controlCenter();
  return {
    optics,
    geometry,
    centerX: center.x,
    centerY: center.y,
    touch: {
      x: d.touchX,
      y: d.touchY,
      pullX: d.pullX,
      pullY: d.pullY,
      press: d.press,
      radius: touchRadius(),
      waveAmp: d.waveAmp,
      wavePhase: d.wavePhase,
    },
    press: d.press,
    // На полной величине `u_active` подмешивает в тело 40% светло-серого — деталь выглядит
    // подсвеченной, а не тронутой. Отклик должен читаться формой и бликом, поэтому сюда
    // уходит только доля: блик и подсветка кромки остаются, заливка — нет.
    active: d.active * 0.3,
    light: lightFor(center.x, center.y),
    appear,
    accent: params.has('accent') ? { color: ACCENT_RGB } : undefined,
  };
}

// ПОЛЗУНОК — орган, который в покое стеклом НЕ является (эталон §5): ручка матовая, и только
// под пальцем она поднимается в стекло, пропуская сквозь себя дорожку.
const SLIDER_TRACK_W = 360;
const SLIDER_TRACK_H = 6;
const SLIDER_KNOB_W = 72;
const SLIDER_KNOB_H = 44;
/** Насколько орган вырастает под пальцем. Рост — работа стенда: вся геометрия движения живёт
 *  в одном месте, материал о нём не знает. */
const SLIDER_GROW = 0.15;
const SLIDER_FILL = '#2f6df6';
const SLIDER_TRACK = 'rgba(255,255,255,0.22)';
const SLIDER_KNOB_SOLID = '#ffffff';

const sliderDeform = createDeform();
let sliderValue = 0.42;

const sliderCenterY = () => canvas.height * 0.5;
const sliderLeft = () => (viewWidthCss() - SLIDER_TRACK_W) / 2;
const sliderKnobX = () => sliderLeft() + SLIDER_TRACK_W * sliderValue;

/** Дорожка живёт В ПОЛОТНЕ, а не в маске краски: только тогда её преломляет линза, и видно,
 *  что ручка действительно стала стеклом, а не просто посветлела. */
function drawSliderTrack(ctx: CanvasRenderingContext2D, d: number): void {
  const y = sliderCenterY();
  const h = SLIDER_TRACK_H * d;
  const capsule = (x: number, w: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x * d, y - h / 2, w * d, h, h / 2);
    ctx.fill();
  };
  capsule(sliderLeft(), SLIDER_TRACK_W, SLIDER_TRACK);
  capsule(sliderLeft(), SLIDER_TRACK_W * sliderValue, SLIDER_FILL);
}

/**
 * Матовая ручка в покое. Рисуется ПОВЕРХ кадра, а не в полотно: в полотне её увидел бы зонд,
 * принял белое пятно за окружение и раздул свечение под пальцем до фонаря — замерено, стекло
 * от этого переставало читаться. Поверх — она и есть то, что уступает место линзе: гаснет
 * ровно настолько, насколько та поднялась (`raiseIntoGlass`), доли перекрываются.
 */
function drawSliderKnobSolid(): void {
  const ctx = solidCtx;
  if (!ctx) return;
  ctx.clearRect(0, 0, solidLayer.width, solidLayer.height);
  if (state.view !== 'slider') return;
  const press = sliderDeform.sample().press;
  const { solid } = raiseIntoGlass(press);
  if (solid <= 0.001) return;
  const grow = 1 + SLIDER_GROW * press;
  const w = SLIDER_KNOB_W * grow * dpr;
  const h = SLIDER_KNOB_H * grow * dpr;
  ctx.save();
  ctx.globalAlpha = solid;
  ctx.fillStyle = SLIDER_KNOB_SOLID;
  ctx.beginPath();
  ctx.roundRect(sliderKnobX() * dpr - w / 2, sliderCenterY() - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.restore();
}

function sliderPiece() {
  const s = sliderDeform.sample();
  const { glass } = raiseIntoGlass(s.press);
  const grow = 1 + SLIDER_GROW * s.press;
  const knob = {
    width: SLIDER_KNOB_W * grow,
    height: SLIDER_KNOB_H * grow,
    cornerRadius: (SLIDER_KNOB_H * grow) / 2,
  };
  const centerX = sliderKnobX() * dpr;
  const centerY = sliderCenterY();
  return {
    optics: optic(materialForInk(currentMaterial(), false)),
    geometry: knob,
    centerX,
    centerY,
    touch: {
      x: s.touchX,
      y: s.touchY,
      pullX: s.pullX,
      pullY: s.pullY,
      press: s.press,
      radius: 0.72 * Math.min(knob.width, knob.height) * 0.5,
      waveAmp: s.waveAmp,
      wavePhase: s.wavePhase,
    },
    press: s.press,
    active: s.active * 0.3,
    light: lightFor(centerX, centerY),
    // Стекла в покое нет вовсе: орган матовый, и линза НАРАСТАЕТ под пальцем — тем же
    // механизмом, которым деталь появляется на экране (эталон §12: не прозрачностью).
    appear: glass,
    // Ручка этого рода под пальцем отрывается от подложки, а не вдавливается в неё. Это
    // НАПРАВЛЕНИЕ, а не величина: насколько она уже поднялась, знает нажатие.
    lift: 1,
  };
}

const PHONE_COUNT = 5;
// Оттенок дымки на экране-предложении: в продукте придёт от обложки, здесь крутится адресом.
const APP_SCREEN = 1;
/** Экраны с фоном приложения. Нулевой остаётся на голой зоне намеренно: на клетке видно, что
 *  именно делает преломление, а на дымке — нет. */
const APP_BACKGROUNDS = [1, 2, 3, 4];
/** Экран-витрина начертаний: по нему выбирается гротеск для витринных надписей. */
const TYPE_SCREEN = 4;
/** Экран трека: обложка с подписью. Самый тяжёлый фон для материала из всех, что есть. */
const COVER_SCREEN = 2;
/** Экран навигации: те же кнопки, но со значками — контент ПОВЕРХ стекла. */
const NAV_SCREEN = 3;
const accentHue = Number(params.get('hue') ?? 265);
/** Акцент экрана в RGB — им тонируется главное действие (M 16:08). */
const ACCENT_RGB = hslToRgb(accentHue, 0.62, 0.5);

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
/**
 * Ряды деталей на экранах телефонов. Ряд — ОДИН описатель на все экраны: пустые кнопки,
 * навигация со значками и плашка под мини-плеер отличаются полями, а не отдельным набором
 * кода. Разводить их (своя раскладка, свои деформации, своё состояние) значит держать один и
 * тот же код дважды.
 */
type ButtonRow = {
  screen: number;
  /** Высота детали; у круглой кнопки — она же диаметр. */
  size: number;
  /** Ширина; по умолчанию равна высоте, то есть деталь круглая. */
  width?: number;
  /** Скругление прямоугольной детали. */
  radius?: number;
  /** На сколько ряд поднят над нижним краем экрана. */
  lift?: number;
  /** Центр ряда от ВЕРХА экрана — у верхней панели; тогда `lift` не нужен. */
  top?: number;
  count: number;
  icons?: readonly IconName[];
  /** Плашка несёт мини-плеер: обложку, две строки и кнопку плей/паузы. */
  player?: boolean;
  /** Деталь несёт краску «ПОТОК» — главное действие экрана трека. */
  flow?: boolean;
  /** Приложение рисует ПОВЕРХ стекла: значки навигации, обложка и строки плеера. Без этого
   *  требование читаемости выключается — разводить светлоту не с чем. */
  content?: boolean;
  /** `toggle` — каждая деталь сама по себе; `single` — выбор один на ряд, как в навигации;
   *  `none` — состояния нет, плашка только отзывается на палец. */
  select: 'toggle' | 'single' | 'none';
};

const NAV_SIZE = 52;
const PLATE_HEIGHT = 48;
/** Плашка отбита от ВЕРХА кнопок навигации, а не от края экрана: между ними полоса фона. */
const PLATE_GAP = 14;

const ROWS: readonly ButtonRow[] = [
  { screen: 0, size: 56, count: 4, select: 'toggle' },
  { screen: APP_SCREEN, size: 56, count: 4, select: 'toggle' },
  {
    screen: NAV_SCREEN,
    size: PLATE_HEIGHT,
    width: PHONE.width - SCREEN_MARGIN * 2,
    // Радиус вложен в угол экрана (`SCREEN_INNER_RADIUS`), а не подобран. Ниже 12 нельзя:
    // фаска здесь 8 dp, и на таком радиусе она съедает угол целиком — свет собирается в точку.
    radius: SCREEN_INNER_RADIUS,
    lift: NAV_SIZE / 2 + PLATE_GAP + PLATE_HEIGHT / 2,
    count: 1,
    player: true,
    content: true,
    select: 'none',
  },
  {
    screen: NAV_SCREEN,
    size: NAV_SIZE,
    count: NAV_ICONS.length,
    icons: NAV_ICONS,
    content: true,
    select: 'single',
  },
  {
    screen: COVER_SCREEN,
    size: FLOW_BUTTON.height,
    width: FLOW_BUTTON.width,
    radius: FLOW_BUTTON.radius,
    lift: FLOW_BUTTON.lift - 58,
    count: 1,
    flow: true,
    content: true,
    select: 'none',
  },
  {
    screen: COVER_SCREEN,
    size: 40,
    top: TOP_BAR_Y,
    count: 1,
    icons: ['vire-chevron-down'],
    content: true,
    select: 'none',
  },
];

const rowWidth = (row: ButtonRow) => row.width ?? row.size;

/** Сквозной индекс первой кнопки ряда — по нему адресуются деформации и активность. */
const ROW_OFFSETS = ROWS.reduce<number[]>((acc) => {
  acc.push((acc.at(-1) ?? 0) + (acc.length ? ROWS[acc.length - 1].count : 0));
  return acc;
}, []);
const BUTTON_TOTAL = ROWS.reduce((n, row) => n + row.count, 0);

/** Материал кнопок свой, а не панельный: ползунки правят только контрольный образец. */
const BUTTON_MATERIAL = clearMode ? VIREGLASS_CLEAR_MATERIAL : VIREGLASS_CONTROL_MATERIAL;
/** Полярность — У КАЖДОЙ КНОПКИ СВОЯ, по её собственному зонду. Общей на весь кадр она
 *  бралась с первой детали: над светлой клеткой выходила тёмная надпись, и требование
 *  читаемости выбеливало тело кнопок навигации на ЧЁРНОМ фоне до матового диска. */
const buttonInk = new Array<number>(BUTTON_TOTAL).fill(INK_LIGHT);
/** Плашка мини-плеера — стекло над списком: по её стилю выбирается стиль края прокрутки. */
const PLATE_INDEX = ROW_OFFSETS[ROWS.findIndex((row) => row.player)];
const plateInkLight = () => buttonInk[PLATE_INDEX] === INK_LIGHT;

function updateButtonInk(probes: readonly ({ luma: number; hi: number } | null)[]): void {
  for (let i = 0; i < BUTTON_TOTAL; i += 1) {
    const sample = probes[i];
    if (!sample) continue;
    const was = buttonInk[i] === INK_LIGHT;
    const next = shouldInkBeLight(sample, was) ? INK_LIGHT : INK_DARK;
    if (next !== buttonInk[i]) wake();
    buttonInk[i] = next;
  }
}

type ButtonSpot = { x: number; y: number; row: ButtonRow; place: number };

/** Раскладка всех деталей в CSS-координатах кадра — общая для отрисовки, значков и попадания. */
function buttonLayout(): ButtonSpot[] {
  return ROWS.flatMap((row) => {
    const origin = phoneOrigin(row.screen);
    const w = rowWidth(row);
    const span = PHONE.width - SCREEN_MARGIN * 2;
    const gap = row.count > 1 ? (span - row.count * w) / (row.count - 1) : 0;
    const y = origin.y + (row.top ?? PHONE.height - 58 - (row.lift ?? 0)) + offset.y;
    return Array.from({ length: row.count }, (_, place) => ({
      x: origin.x + SCREEN_MARGIN + (w + gap) * place + w / 2 + offset.x,
      y,
      row,
      place,
    }));
  });
}

/** У каждой кнопки своя деформация: нажимают их по отдельности. */
const buttonDeforms = Array.from({ length: BUTTON_TOTAL }, () => createDeform());

// Активное состояние показывается МАТЕРИАЛОМ: активная чуть толще, отчего плотнее тело и шире
// фаска, плюс кромка ярче. Заливать её цветом нельзя — стекло перестаёт быть стеклом.
const buttonActive = new Array<number>(BUTTON_TOTAL).fill(0);
const buttonActiveTarget = new Array<number>(BUTTON_TOTAL).fill(0);
// В навигации выбор один на ряд, поэтому стартовое состояние задаётся здесь, а не кликом.
ROWS.forEach((row, r) => {
  if (row.select === 'single') buttonActiveTarget[ROW_OFFSETS[r]] = 1;
});

function stepButtonActive(dt: number): boolean {
  let moving = false;
  for (let i = 0; i < BUTTON_TOTAL; i += 1) {
    const delta = buttonActiveTarget[i] - buttonActive[i];
    if (Math.abs(delta) < 0.002) {
      buttonActive[i] = buttonActiveTarget[i];
      continue;
    }
    buttonActive[i] += delta * (1 - Math.exp(-dt / 0.14));
    moving = true;
  }
  return moving;
}

/** Играет ли трек: значок на плашке переключается между плей и паузой. */
let playing = true;

/** Длина трека. Короткая нарочно: за полторы минуты граница проходит плашку целиком, и
 *  движение видно, не дожидаясь настоящих четырёх минут. */
const TRACK_SECONDS = 90;
let progress = 0.34;
let progressShown = progress;

/** Прогресс двигает границу подсветки. Кадр будится, только когда она уехала хотя бы на
 *  полпикселя: зонд снимает фон и досчитывается, гонять его ради невидимого сдвига незачем. */
function stepProgress(dt: number): boolean {
  if (!playing) return false;
  progress = (progress + dt / TRACK_SECONDS) % 1;
  if (Math.abs(progress - progressShown) * (PHONE.width - SCREEN_MARGIN * 2) < 0.5) return false;
  progressShown = progress;
  return true;
}

/** Клик по детали: тумблер сам по себе, выбор гасит соседей по ряду. У плашки своего состояния
 *  нет, но на ней живёт кнопка плеера — переключается она, и только по своему месту. */
function toggleButton(index: number, localX: number, localY: number): void {
  const spot = buttonLayout()[index];
  if (spot.row.select === 'none') {
    if (spot.row.player && hitPlay(rowWidth(spot.row), localX, localY)) playing = !playing;
    return;
  }
  if (spot.row.select === 'toggle') {
    buttonActiveTarget[index] = buttonActiveTarget[index] > 0.5 ? 0 : 1;
    return;
  }
  const rowStart = index - spot.place;
  for (let i = 0; i < spot.row.count; i += 1) buttonActiveTarget[rowStart + i] = 0;
  buttonActiveTarget[index] = 1;
}

// Маска значков: одна на кадр, в экранных координатах — шейдер сэмплит её по позиции пикселя,
// поэтому значок каждой кнопки просто рисуется в неё на своём месте.
const iconCanvas = document.createElement('canvas');
const iconCtx = iconCanvas.getContext('2d');
function clearMask(): CanvasRenderingContext2D | null {
  if (!iconCtx) return null;
  if (iconCanvas.width !== canvas.width || iconCanvas.height !== canvas.height) {
    iconCanvas.width = canvas.width;
    iconCanvas.height = canvas.height;
  }
  iconCtx.globalCompositeOperation = 'source-over';
  iconCtx.filter = 'none';
  iconCtx.fillStyle = '#000000';
  iconCtx.fillRect(0, 0, iconCanvas.width, iconCanvas.height);
  return iconCtx;
}

function updateIconMask(): HTMLCanvasElement | null {
  if (!clearMask() || !iconCtx) return null;
  // Форму краски шейдер читает ЗЕЛЁНЫМ каналом маски, а не альфой. Поэтому маска — белым по
  // ЧЁРНОМУ: при рисовании по прозрачному сглаживание уходит в альфу, зелёный внутри штриха
  // остаётся единицей до самого края, и границы выходят рваными.
  //
  // Спокойного основания под краской здесь НЕТ и быть не должно: это свойство материала
  // (legibility), одинаковое по всей детали. Пока его подкладывала лаборатория, у значка оно
  // было одно, у плашки другое, и разница ничем не объяснялась.
  for (const spot of buttonLayout()) {
    const icon = spot.row.icons?.[spot.place];
    if (!icon && !spot.row.player && !spot.row.flow) continue;
    iconCtx.save();
    iconCtx.translate(spot.x * dpr, spot.y * dpr);
    if (icon) drawIcon(iconCtx, icon, Math.round(spot.row.size * 0.46) * dpr);
    else if (spot.row.flow) drawFlowInk(iconCtx, dpr);
    else drawPlayerInk(iconCtx, rowWidth(spot.row), dpr, playing);
    iconCtx.restore();
  }
  popover.drawInk(iconCtx, dpr);
  return iconCanvas;
}

/** Цветной слой кадра: обложки. Едет в материал тем же каналом, что и краска, — иначе при
 *  нажатии надпись деформируется, а обложка стоит на месте. */
function updateColorLayer(): HTMLCanvasElement | null {
  if (!overlayCtx) return null;
  if (overlay.width !== canvas.width || overlay.height !== canvas.height) {
    overlay.width = canvas.width;
    overlay.height = canvas.height;
  }
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  for (const spot of buttonLayout()) {
    if (!spot.row.player) continue;
    overlayCtx.save();
    overlayCtx.translate(spot.x * dpr, spot.y * dpr);
    drawCover(overlayCtx, rowWidth(spot.row), dpr);
    overlayCtx.restore();
  }
  return overlay;
}

function buttonPieces() {
  return buttonLayout().map((spot, i) => {
    // Главное действие тонировано акцентом, и краска на цветном стекле всегда светлая.
    const tinted = Boolean(spot.row.flow);
    const light = tinted || buttonInk[i] === INK_LIGHT;
    const d = buttonDeforms[i].sample();
    // РОЛЬ ДЕТАЛИ МАТЕРИАЛ НЕ МЕНЯЕТ. Главное действие экрана я сначала сделал более плотным
    // стеклом — и на кадре рядом плашка, кнопки навигации и «ПОТОК» перестали читаться одним
    // материалом: три разных стекла вместо одного. Роль показывают КРАСКА, размер и место,
    // а материал у всех деталей продукта обязан быть один; меняет его только состояние.
    const on = buttonActive[i];
    // Краска детали — это и значок навигации, и строки плеера: обе едут одной маской.
    const hasInk = Boolean(spot.row.icons) || Boolean(spot.row.player) || Boolean(spot.row.flow);
    return {
      // Толщина — ПРИЧИНА: из неё следуют и плотность тела, и ширина фаски. Поднимать
      // следствия по отдельности значит собирать состояние, которого у стекла не бывает.
      // Материал детали собирается ИЗ ЯДРА, а не по месту: несёт ли она краску и активна ли
      // она — вопросы к материалу, и ответ на них обязан быть один на вебе и на Android.
      optics: optic({
        ...activeMaterial(materialForInk(BUTTON_MATERIAL, Boolean(spot.row.content)), on),
        ink: light ? INK_LIGHT : INK_DARK,
      }),
      accent: tinted ? { color: ACCENT_RGB } : undefined,
      geometry: spot.row.width
        ? roundedRectGeometry(spot.row.width, spot.row.size, spot.row.radius ?? spot.row.size / 2)
        : circleGeometry(spot.row.size),
      // Кнопки принадлежат ЭКРАНУ, а не кадру: полотно тянут — они едут вместе с ним.
      centerX: spot.x * dpr,
      centerY: spot.y * dpr,
      light: lightFor(spot.x * dpr, spot.y * dpr),
      touch: {
        x: d.touchX,
        y: d.touchY,
        pullX: d.pullX,
        pullY: d.pullY,
        press: d.press,
        // Палец — площадь, а не точка: радиус контакта берётся от МЕНЬШЕГО полуразмера, иначе
        // на широкой плашке касание расползлось бы на всю её длину.
        radius: 0.72 * (Math.min(rowWidth(spot.row), spot.row.size) / 2),
        waveAmp: d.waveAmp,
        wavePhase: d.wavePhase,
      },
      press: d.press,
      // Касание и активность идут в одну униформу: берётся сильнейшее, иначе нажатие на уже
      // активную кнопку выглядело бы как её выключение.
      //
      // Выбранная кнопка отдаёт активность ЦЕЛИКОМ. Половина стояла, пока активность
      // подмешивала в тело светло-серое и деталь выглядела подсвеченной; тело этого больше не
      // делает (surface-shader.ts), а срезанная вдвое активность только глушила единственный
      // признак состояния, который фон не может подделать, — саму краску.
      active: Math.max(d.active * 0.3, on),
      // Прогресс трека — не полоска поверх стекла, а само активное состояние, заданное полем:
      // сыгранная часть детали различимее и ярче блестит. Остальным деталям он не нужен.
      progress: spot.row.player ? progress : undefined,
      icon: hasInk,
      overlay: Boolean(spot.row.player),
      // Невыбранный значок приглушён цветом, а не прозрачностью: альфу задаёт маска, и гасить
      // её пришлось бы отдельным набором значков. Полярность — та же, что у тела.
      inkIdle: tinted ? [1, 1, 1, 1] : light ? [0.72, 0.76, 0.82, 1] : [0.24, 0.26, 0.3, 1],
      inkActive: light ? [1, 1, 1, 1] : [0.05, 0.06, 0.08, 1],
    };
  });
}

/** Меню «ещё» на экране трека растёт из капсулы верхней панели (M 5:11). */
const popover = createPopover(() => {
  const origin = phoneOrigin(COVER_SCREEN);
  return {
    right: origin.x + PHONE.width - SCREEN_MARGIN + offset.x,
    top: origin.y + TOP_BAR_Y - CAPSULE.height / 2 + offset.y,
  };
}, a11y.reduceMotion);
if (params.get('menu') === '1') popover.setOpen(true);
let popoverInk = INK_LIGHT;

function updatePopoverInk(sample: { luma: number; hi: number } | null): void {
  if (!sample) return;
  const next = shouldInkBeLight(sample, popoverInk === INK_LIGHT) ? INK_LIGHT : INK_DARK;
  if (next !== popoverInk) wake();
  popoverInk = next;
}

/** Разрыв и слияние (M 5:02) — своя сцена: в эталоне он тоже показан отдельно, крупно. */
const group = createGroup(() => ({ x: viewWidthCss() / 2, y: canvas.height / dpr / 2 }), a11y.reduceMotion);
let groupInk = INK_LIGHT;

function updateGroupInk(sample: { luma: number; hi: number } | null): void {
  if (!sample) return;
  const next = shouldInkBeLight(sample, groupInk === INK_LIGHT) ? INK_LIGHT : INK_DARK;
  if (next !== groupInk) wake();
  groupInk = next;
}

function groupPiece() {
  const frame = group.frame(dpr);
  const ink = groupInk === INK_LIGHT ? [1, 1, 1, 1] : [0.06, 0.07, 0.09, 1];
  return {
    ...frame,
    optics: optic({ ...materialForInk(BUTTON_MATERIAL, true), ink: groupInk }),
    light: lightFor(frame.centerX, frame.centerY),
    icon: true,
    inkIdle: ink,
    inkActive: ink,
  };
}

function updateGroupMask(): HTMLCanvasElement | null {
  const ctx = clearMask();
  if (!ctx) return null;
  group.drawInk(ctx, dpr);
  return iconCanvas;
}

function popoverPiece() {
  const frame = popover.frame(dpr);
  // Меню читают, а не выбирают в нём: краска полной силы, без приглушённого покоя.
  const ink = popoverInk === INK_LIGHT ? [1, 1, 1, 1] : [0.06, 0.07, 0.09, 1];
  return {
    ...frame,
    optics: optic({ ...materialForInk(BUTTON_MATERIAL, true), ink: popoverInk }),
    light: lightFor(frame.centerX, frame.centerY),
    icon: true,
    inkIdle: ink,
    inkActive: ink,
  };
}

function renderFrame() {
  const ink = manualInk ? material.ink : polarity === 'тёмная' ? INK_DARK : INK_LIGHT;
  const zone = ZONES[state.zone].draw;
  const screens = state.view === 'screens';
  const morph = state.view === 'morph';
  const slider = state.view === 'slider';
  // Динамика считается ТОЛЬКО пока видна зона среды: иначе такт натурального фона в покое
  // копится за кулисами и при возврате на зону выдаёт залп «пропущенных» следов разом.
  const mediumFrame = onMediumZone()
    ? mediumDynamics.step({
        state: mediumPlaybackState,
        bpm: mediumBpm,
        amplitude: syntheticAmplitude(mediumTime),
        positionSeconds: mediumPosition,
        sourcePoint: MEDIUM_SOURCE_POINT,
        dt: lastDt,
      })
    : { turbulence: 0, emissions: [] };
  mediumTurbulence = mediumFrame.turbulence;
  mediumEmitCount += mediumFrame.emissions.length;
  return renderer.render({
    density: dpr,
    debug: DEBUG_MODES[state.debug] as VireGlassDebugMode,
    scene: onMediumZone()
      ? undefined
      : screens
      ? (ctx, w, h, ox, oy, d) => {
          zone(ctx, w, h, ox, oy, d);
          for (const i of APP_BACKGROUNDS) drawAppBackground(ctx, dpr, i, ox, oy, accentHue);
          drawCoverScreen(ctx, dpr, COVER_SCREEN, ox, oy, progress, playing);
          drawTypeSpecimen(ctx, dpr, TYPE_SCREEN, ox, oy, scrollOf(TYPE_SCREEN));
          // Список — обычный контент, и живёт он В ПОЛОТНЕ, под линзами: стекло обязано его
          // преломлять, иначе плашка висит не над экраном, а рядом с ним.
          drawRecentScreen(ctx, dpr, NAV_SCREEN, ox, oy, scrollOf(NAV_SCREEN), recentScrollMax(), plateInkLight());
          // Притенение низа идёт ПОСЛЕ контента: под панелью управления экран обязан быть
          // спокойным, а в фоне этот же градиент оказывался под списком и не работал.
          for (const i of APP_BACKGROUNDS) drawFoot(ctx, dpr, i, ox, oy);
          drawPhoneFrames(ctx, dpr, PHONE_COUNT, ox, oy);
        }
      : slider
        ? (ctx, w, h, ox, oy, d) => {
            zone(ctx, w, h, ox, oy, d);
            drawSliderTrack(ctx, dpr);
          }
        : zone,
    offsetX: offset.x * dpr,
    offsetY: offset.y * dpr,
    iconMask: screens ? updateIconMask() : morph ? updateGroupMask() : null,
    colorLayer: screens ? updateColorLayer() : null,
    pieces:
      glassCount !== null
        ? glassPieces(glassCount)
        : screens
          ? [...buttonPieces(), popoverPiece()]
          : morph
            ? [groupPiece()]
            : slider
              ? [sliderPiece()]
              : onReferenceScene()
                ? [controlPiece()]
                : [controlPiece(), ...samplePieces(ink)],
    backdrop: onMediumZone()
      ? medium.pass({
          gridWidth: mediumGrid().width,
          gridHeight: mediumGrid().height,
          dt: lastDt,
          params: {
            turbulence: mediumFrame.turbulence,
            ...(mediumAdvectSpeedOverride !== null && Number.isFinite(mediumAdvectSpeedOverride)
              ? { advectSpeed: mediumAdvectSpeedOverride }
              : {}),
            ...(mediumCoverLights ? { lights: mediumCoverLights } : {}),
            ...mediumParamOverrides,
          },
          emissions: mediumFrame.emissions,
        })
      : undefined,
  });
}

function applyPolarity(sample: { luma: number; hi: number }): void {
  if (manualInk) return;
  const light = shouldInkBeLight(sample, polarity === 'светлая');
  const next = light ? 'светлая' : 'тёмная';
  // Замер зонда приходит с отставанием, и полярность может смениться на ПОСЛЕДНЕМ кадре
  // досчёта. Без побудки состояние уже новое, а на экране остаётся кадр со старой полярностью.
  if (next !== polarity) wake();
  polarity = next;
  optics = optic({ ...material, ink: light ? INK_LIGHT : INK_DARK });
}

function describe(probe: { luma: number; busy: number; lo: number; hi: number } | null): string {
  const presetName = state.preset >= 0 ? PRESET_NAMES[state.preset] : 'база';
  const mediumInfo = onMediumZone()
    ? ` · сетка среды ${mediumGrid().width}×${mediumGrid().height} · playback=${mediumPlaybackState} ` +
      `bpm=${mediumBpm} turb=${mediumTurbulence.toFixed(2)} emit=${mediumEmitCount}`
    : '';
  const glassInfo = glassCount !== null ? ` · стёкол=${glassCount}` : '';
  return (
    `${canvas.width}×${canvas.height} · zone=${state.zone}(${ZONE_NAMES[state.zone]}) · ` +
    `preset=${presetName} · debug=${state.debug}(${DEBUG_MODES[state.debug]}) · надпись ${polarity}` +
    `${mediumInfo}${glassInfo}\n` +
    (probe
      ? `probe luma=${probe.luma.toFixed(3)} busy=${probe.busy.toFixed(3)} lo=${probe.lo.toFixed(3)} hi=${probe.hi.toFixed(3)}`
      : 'probe: контрольный образец вне кадра — прокрути полотно к нему') +
    `\nнажатие ${deform.sample().press.toFixed(2)} · тяга ${deform.sample().pullX.toFixed(1)}, ${deform.sample().pullY.toFixed(1)}`
  );
}

let lastFrame = performance.now();

/** Пока деталь не успокоилась, кадры идут подряд: анимация живёт вне «досчёта» зонда. */
function wake(): void {
  pending = Math.max(pending, 2);
}

function tick(now: number): void {
  requestAnimationFrame(tick);
  // Шаг ограничен: после переключения вкладки rAF приносит секунды, и пружина взорвалась бы.
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  lastDt = dt;
  mediumTime += dt;
  if (mediumPlaybackState === 'playing') mediumPosition += dt;
  // Шагают ВСЕ деформации: кнопок четыре, и каждая живёт своей пружиной.
  deform.step(dt);
  sliderDeform.step(dt);
  for (const d of buttonDeforms) d.step(dt);
  const activeMoving = stepButtonActive(dt);
  const appearing = stepAppear(dt);
  const popoverMoving = popover.step(dt);
  const groupMoving = group.step(dt);
  const progressing = stepProgress(dt);
  if (
    appearing ||
    activeMoving ||
    popoverMoving ||
    groupMoving ||
    progressing ||
    onMediumZone() ||
    benchMode ||
    !deform.idle() ||
    !sliderDeform.idle() ||
    buttonDeforms.some((d) => !d.idle())
  ) {
    wake();
  }
  if (pending <= 0) return;
  const probes = renderFrame().probes;
  drawSliderKnobSolid();
  const probe = probes[0];
  if (state.view === 'screens') {
    updateButtonInk(probes);
    updatePopoverInk(probes[BUTTON_TOTAL] ?? null);
  } else if (state.view === 'morph') updateGroupInk(probe);
  else if (probe) applyPolarity(probe);
  pending -= 1;
  // Метка и панель обновляются КАЖДЫЙ кадр, а не по окончании досчёта: иначе правка,
  // сделанная во время досчёта, остаётся без отражения, и панель выглядит мёртвой.
  panel?.update({ view: state.view, zone: state.zone, preset: state.preset, debug: state.debug, material }, optics);
  label.textContent = describe(probe);
  if (!ready) {
    document.body.append(label);
    ready = true;
  }
}

window.addEventListener('resize', () => {
  resize();
  placeCaptions();
  pending = SETTLE_FRAMES;
});

const overPanel = (target: EventTarget | null) => Boolean((target as Element | null)?.closest?.('.vg-panel'));

function moveStage(dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  offset.x += dx;
  offset.y += dy;
  pending = SETTLE_FRAMES;
}

/** Прокрутка содержимого главного экрана. Это НЕ протяжка полотна: полотно возит по кадру
 *  весь телефон вместе с линзами, а здесь под неподвижным стеклом едет контент — только так и
 *  видно, что материал делает с проезжающей под ним строкой. */
/** Прокрутка содержимого — У КАЖДОГО ЭКРАНА СВОЯ. Она двигает контент под неподвижным стеклом,
 *  тогда как протяжка полотна возит по кадру весь телефон вместе с его линзами. Экран без
 *  записи в этой таблице не прокручивается вовсе, и колесо над ним двигает полотно. */
const SCROLL_MAX: ReadonlyMap<number, () => number> = new Map([
  [NAV_SCREEN, recentScrollMax],
  [TYPE_SCREEN, typeScrollMax],
]);
const screenScroll = new Map<number, number>();
const scrollOf = (screen: number) => screenScroll.get(screen) ?? 0;

/** Прокручен ли экран. `false` — экран не прокручиваемый, колесо достаётся полотну. */
function scrollScreen(screen: number, dy: number): boolean {
  const max = SCROLL_MAX.get(screen);
  if (!max) return false;
  const next = Math.min(Math.max(scrollOf(screen) + dy, 0), max());
  if (next !== scrollOf(screen)) {
    screenScroll.set(screen, next);
    pending = SETTLE_FRAMES;
  }
  return true;
}

/** Экран телефона под курсором. По нему колесо решает, что крутить: содержимое или полотно. */
function screenUnder(clientX: number, clientY: number): number | null {
  for (let i = 0; i < PHONE_COUNT; i += 1) {
    const o = phoneOrigin(i);
    const x = clientX - offset.x - o.x;
    const y = clientY - offset.y - o.y;
    if (x >= 0 && x <= PHONE.width && y >= 0 && y <= PHONE.height) return i;
  }
  return null;
}

// Полотно тянут мышью — так и смотрят, как деталь гнёт то, что под неё заезжает. Колесо
// делает то же по вертикали, с Shift — по горизонтали. Ход не ограничен: сетка бесконечна.
window.addEventListener(
  'wheel',
  (event) => {
    if (overPanel(event.target)) return;
    if (event.shiftKey) {
      moveStage(-event.deltaY / dpr, 0);
      return;
    }
    // Над главным экраном колесо крутит ЕГО содержимое: полотно там таскают мышью, а вот
    // прогнать список под плашкой иначе нечем.
    if (state.view === 'screens') {
      const screen = screenUnder(event.clientX, event.clientY);
      if (screen !== null && scrollScreen(screen, event.deltaY / dpr)) return;
    }
    moveStage(-event.deltaX / dpr, -event.deltaY / dpr);
  },
  { passive: true },
);

/** Попал ли палец в контрольный образец — с небольшим запасом, чтобы не мазать по кромке. */
type Target = {
  deform: ReturnType<typeof createDeform>;
  localX: number;
  localY: number;
  limit: number;
  /** Индекс кнопки, если попали в неё: только их состояние переключается кликом. */
  index?: number;
  /** Попали в меню «ещё» или в капсулу, из которой оно растёт. */
  popover?: PopoverHit;
  /** Попали в группу на сцене морфинга. */
  group?: boolean;
  /** Попали в ручку ползунка: жест ведёт её вдоль дорожки, а не таскает полотно. */
  slider?: boolean;
};

/** Какая деталь под пальцем — в обоих режимах, с запасом, чтобы не мазать по кромке. */
function pickTarget(clientX: number, clientY: number): Target | null {
  if (state.view === 'slider') {
    const dx = clientX - sliderKnobX();
    const dy = clientY - sliderCenterY() / dpr;
    // Запас по вертикали щедрее ручки: по дорожке целятся пальцем, а не курсором.
    if (Math.abs(dx) > SLIDER_KNOB_W / 2 + 10 || Math.abs(dy) > SLIDER_KNOB_H / 2 + 12) return null;
    return { deform: sliderDeform, localX: dx, localY: dy, limit: 0, slider: true };
  }
  if (state.view === 'morph') {
    const hit = group.pick(clientX, clientY);
    if (!hit) return null;
    return { deform: group.deform, localX: hit.localX, localY: hit.localY, limit: 4, group: true };
  }
  if (state.view === 'screens') {
    // Меню лежит поверх экрана, поэтому палец достаётся ему первым.
    const pop = popover.pick(clientX, clientY);
    if (pop) {
      return {
        deform: popover.deform,
        localX: pop.localX,
        localY: pop.localY,
        limit: 0.14 * pop.halfMin,
        popover: pop.hit,
      };
    }
    const layout = buttonLayout();
    for (let i = 0; i < layout.length; i += 1) {
      const row = layout[i].row;
      const dx = clientX - layout[i].x;
      const dy = clientY - layout[i].y;
      const halfW = rowWidth(row) / 2;
      const halfH = row.size / 2;
      const inside = row.width
        ? Math.abs(dx) <= halfW + 6 && Math.abs(dy) <= halfH + 6
        : Math.hypot(dx, dy) <= halfH + 6;
      if (inside) {
        return {
          deform: buttonDeforms[i],
          localX: dx,
          localY: dy,
          limit: 0.14 * Math.min(halfW, halfH),
          index: i,
        };
      }
    }
    return null;
  }
  const center = controlCenter();
  const dx = clientX - center.x / dpr;
  const dy = clientY - center.y / dpr;
  if (Math.abs(dx) <= geometry.width / 2 + 8 && Math.abs(dy) <= geometry.height / 2 + 8) {
    return { deform, localX: dx, localY: dy, limit: pullLimit() };
  }
  return null;
}

type Gesture = { target: Target | null; startX: number; startY: number };
let gesture: Gesture | null = null;

canvas.style.cursor = 'grab';
canvas.addEventListener('pointerdown', (event) => {
  if (overPanel(event.target)) return;
  canvas.setPointerCapture(event.pointerId);
  const target = pickTarget(event.clientX, event.clientY);
  gesture = { target, startX: event.clientX, startY: event.clientY };
  canvas.style.cursor = 'grabbing';
  if (target) {
    target.deform.grab(target.localX, target.localY, WAVE_ON_TOUCH);
    wake();
  }
});
canvas.addEventListener('pointermove', (event) => {
  pointer = { x: event.clientX, y: event.clientY };
  wake();
  if (!gesture) {
    canvas.style.cursor = pickTarget(event.clientX, event.clientY) ? 'pointer' : 'grab';
    return;
  }
  if (gesture.target?.slider) {
    // Ручка идёт за пальцем по дорожке; тяги у неё нет — орган ездит, а не тянется.
    sliderValue = Math.min(Math.max((event.clientX - sliderLeft()) / SLIDER_TRACK_W, 0), 1);
    wake();
  } else if (gesture.target) {
    gesture.target.deform.drag(
      event.clientX - gesture.startX,
      event.clientY - gesture.startY,
      gesture.target.limit,
    );
    wake();
  } else {
    moveStage(event.movementX / dpr, event.movementY / dpr);
  }
});
const endGesture = (event: PointerEvent) => {
  if (!gesture) return;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  const target = gesture.target;
  if (target) {
    target.deform.release(WAVE_ON_RELEASE);
    wake();
  }
  // Клик — это жест без протяжки: тянули дальше порога, значит переключать нечего.
  if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 6) {
    // Открытое меню закрывается первым: касание мимо него ничего под ним не нажимает.
    if (target?.group) group.click();
    else if (target?.popover) popover.click(target.popover);
    else if (popover.isOpen()) popover.setOpen(false);
    else if (target?.index !== undefined) toggleButton(target.index, target.localX, target.localY);
    wake();
  }
  gesture = null;
  canvas.style.cursor = 'grab';
};
canvas.addEventListener('pointerup', endGesture);
canvas.addEventListener('pointercancel', endGesture);
canvas.addEventListener('pointerleave', () => {
  pointer = null;
  wake();
});
canvas.addEventListener('dblclick', (event) => {
  if (state.view !== 'material' || overPanel(event.target)) return;
  const target = pickTarget(event.clientX, event.clientY);
  if (!target || target.index !== undefined) return;
  appearTarget = appearTarget > 0.5 ? 0 : 1;
  wake();
});

placeCaptions();

// Значки приходят из спрайта асинхронно — как пришли, кадр перерисовывается с ними.
void loadIcons([...NAV_ICONS, ...PLAYER_ICONS, ...TRANSPORT_ICONS, ...POPOVER_ICONS, 'vire-chevron-down']).then(() =>
  wake(),
);

// Гротески приходят файлами, как и значки: пока они не загружены, canvas молча рисует
// системным, и кадр надо пересобрать — иначе стенд показывает не те начертания.
void loadTypefaces().then(() => wake());

requestAnimationFrame(tick);

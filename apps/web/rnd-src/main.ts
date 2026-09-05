// Стенд VireGlass — не React-страница (план, «Среда»/«Следствие для стенда»): статический
// HTML + этот бандл, esbuild собирает его за миллисекунды из `packages/vireglass`.
// Состояние целиком в адресе: ссылка воспроизводит кадр, как диплинк на Android-стенде.
import {
  DEBUG_MODES,
  INK_DARK,
  INK_LIGHT,
  MATERIAL_PRESETS,
  MATERIAL_RANGES,
  PRESET_NAMES,
  resolveOptics,
  roundedRectGeometry,
  circleGeometry,
  VIREGLASS_CONTROL_MATERIAL,
  VIREGLASS_MATERIAL,
  activeMaterial,
  createDeform,
  materialForInk,
  type VireGlassDebugMode,
  type VireGlassMaterial,
  type VireGlassNumericKey,
  halfMinDp,
  shouldInkBeLight,
} from '@vire/vireglass';
import { createVireGlassRenderer } from '@vire/vireglass/web';
import { drawIcon, loadIcons, NAV_ICONS, type IconName } from './icons';
import { drawCover, drawPlayerInk, hitPlay, PLAYER_ICONS } from './mini-player';
import { createPanel } from './panel';
import { drawRecentList, recentScrollMax } from './content';
import {
  drawAppBackground,
  drawPhoneFrames,
  PHONE,
  phoneOrigin,
  SCREEN_MARGIN,
  ZONES,
  ZONE_NAMES,
} from './scenes';

const stage = document.getElementById('stage');
if (!stage) throw new Error('нет #stage');

const canvas = document.createElement('canvas');
stage.append(canvas);

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

const state = {
  zone: intParam('zone', 0, 0, ZONES.length - 1),
  preset: intParam('preset', -1, -1, PRESET_NAMES.length - 1),
  debug: intParam('debug', 0, 0, DEBUG_MODES.length - 1),
  view: params.get('view') === 'screens' ? ('screens' as const) : ('material' as const),
  overrides: new Map<VireGlassNumericKey, number>(),
};

for (const key of MATERIAL_KEYS) {
  const raw = params.get(key);
  if (raw === null) continue;
  const v = Number(raw);
  if (Number.isFinite(v)) state.overrides.set(key, v);
}

function baseMaterial(): VireGlassMaterial {
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
let optics = resolveOptics(material);
let polarity = manualInk ? 'ручная' : 'светлая';

const geometry = roundedRectGeometry(280, 120, 32);
const dpr = window.devicePixelRatio || 1;
const renderer = createVireGlassRenderer(canvas);

function resize(): void {
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  renderer.resize(canvas.width, canvas.height);
}
resize();

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
  optics = resolveOptics(material);
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
  if (state.view === 'screens') next.set('view', 'screens');
  for (const [key, value] of state.overrides) next.set(key, String(Math.round(value * 1000) / 1000));
  if (params.get('ui') === '0') next.set('ui', '0');
  if (params.has('hue')) next.set('hue', String(accentHue));
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
    optics: resolveOptics({ ...sample.material, ink }),
    geometry: roundedRectGeometry(size, size, size * 0.28),
    centerX: (left + i * (size + gap)) * dpr,
    centerY: y,
  }));
}

/** Подписи живут в DOM, а не в сцене: нарисованные в сцену, они попали бы ПОД стекло. */
function placeCaptions(): void {
  const { size, gap, left, y } = sampleLayout();
  const hidden = state.view === 'screens';
  captions.forEach((node, i) => {
    node.style.display = hidden ? 'none' : 'block';
    node.style.left = `${left + i * (size + gap)}px`;
    node.style.top = `${y / dpr + size / 2 + 10}px`;
    node.style.width = `${size + gap}px`;
  });
}

// Волна от касания заметнее, чем от отрыва: палец ударяет по поверхности, отпускание её
// только отпускает. Амплитуды в CSS-пикселях смещения поля.
const WAVE_ON_TOUCH = 4;
const WAVE_ON_RELEASE = 2.5;

const deform = createDeform();

const controlCenter = () => ({ x: (viewWidthCss() / 2) * dpr, y: canvas.height * 0.34 });
// Ход тяги умеренный: тянут пальцем, а не растягивают резину. Деформация локальная, поэтому
// заметна и при небольшой амплитуде — прежние 0.7 полуразмера читались как «слишком много».
const pullLimit = () => 0.14 * halfMinDp(geometry);
/** Радиус влияния пальца: за его пределами поле стоит на месте. */
const touchRadius = () => 0.72 * halfMinDp(geometry);

/**
 * Габарит детали НЕ трогается: тяга, нажатие и волна уходят в поле формы (`vgTouchWarp`).
 * Масштабирование ширины давало абсурд — тянешь правый край, а левый уходит наружу.
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
  };
}

const PHONE_COUNT = 4;
// Оттенок дымки на экране-предложении: в продукте придёт от обложки, здесь крутится адресом.
const APP_SCREEN = 1;
/** Экран навигации: те же кнопки, но со значками — контент ПОВЕРХ стекла. */
const NAV_SCREEN = 3;
const accentHue = Number(params.get('hue') ?? 265);
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
  count: number;
  icons?: readonly IconName[];
  /** Плашка несёт мини-плеер: обложку, две строки и кнопку плей/паузы. */
  player?: boolean;
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
    // Ниже 12 нельзя: фаска материала здесь 8 dp, и на таком радиусе она съедает угол
    // целиком — свет собирается в точку, стекло читается пластиной со снятой кромкой.
    radius: 16,
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
];

const rowWidth = (row: ButtonRow) => row.width ?? row.size;

/** Сквозной индекс первой кнопки ряда — по нему адресуются деформации и активность. */
const ROW_OFFSETS = ROWS.reduce<number[]>((acc) => {
  acc.push((acc.at(-1) ?? 0) + (acc.length ? ROWS[acc.length - 1].count : 0));
  return acc;
}, []);
const BUTTON_TOTAL = ROWS.reduce((n, row) => n + row.count, 0);

/** Полярность кнопок считается по ИХ материалу и их фону, а не по панельному: ползунки правят
 *  контрольный образец, а ручной `ink` вообще выключает автоматику — кнопки тогда оставались
 *  светлополярными над светлым фоном и давились до серого. */
const BUTTON_MATERIAL = VIREGLASS_CONTROL_MATERIAL;
const buttonOptics = resolveOptics(BUTTON_MATERIAL);
/** Полярность — У КАЖДОЙ КНОПКИ СВОЯ, по её собственному зонду. Общей на весь кадр она
 *  бралась с первой детали: над светлой клеткой выходила тёмная надпись, и требование
 *  читаемости выбеливало тело кнопок навигации на ЧЁРНОМ фоне до матового диска. */
const buttonInk = new Array<number>(BUTTON_TOTAL).fill(INK_LIGHT);

function updateButtonInk(probes: readonly ({ luma: number; hi: number } | null)[]): void {
  for (let i = 0; i < BUTTON_TOTAL; i += 1) {
    const sample = probes[i];
    if (!sample) continue;
    const was = buttonInk[i] === INK_LIGHT;
    const next = shouldInkBeLight(sample, buttonOptics.legibility, was) ? INK_LIGHT : INK_DARK;
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
    const y = origin.y + PHONE.height - 58 - (row.lift ?? 0) + offset.y;
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
function updateIconMask(): HTMLCanvasElement | null {
  if (!iconCtx) return null;
  if (iconCanvas.width !== canvas.width || iconCanvas.height !== canvas.height) {
    iconCanvas.width = canvas.width;
    iconCanvas.height = canvas.height;
  }
  // Форму краски шейдер читает ЗЕЛЁНЫМ каналом маски, а не альфой. Поэтому маска — белым по
  // ЧЁРНОМУ: при рисовании по прозрачному сглаживание уходит в альфу, зелёный внутри штриха
  // остаётся единицей до самого края, и границы выходят рваными.
  //
  // Спокойного основания под краской здесь НЕТ и быть не должно: это свойство материала
  // (legibility), одинаковое по всей детали. Пока его подкладывала лаборатория, у значка оно
  // было одно, у плашки другое, и разница ничем не объяснялась.
  iconCtx.globalCompositeOperation = 'source-over';
  iconCtx.filter = 'none';
  iconCtx.fillStyle = '#000000';
  iconCtx.fillRect(0, 0, iconCanvas.width, iconCanvas.height);
  for (const spot of buttonLayout()) {
    const icon = spot.row.icons?.[spot.place];
    if (!icon && !spot.row.player) continue;
    iconCtx.save();
    iconCtx.translate(spot.x * dpr, spot.y * dpr);
    if (icon) drawIcon(iconCtx, icon, 24 * dpr);
    else drawPlayerInk(iconCtx, rowWidth(spot.row), dpr, playing);
    iconCtx.restore();
  }
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
    const light = buttonInk[i] === INK_LIGHT;
    const d = buttonDeforms[i].sample();
    const on = buttonActive[i];
    // Краска детали — это и значок навигации, и строки плеера: обе едут одной маской.
    const hasInk = Boolean(spot.row.icons) || Boolean(spot.row.player);
    return {
      // Толщина — ПРИЧИНА: из неё следуют и плотность тела, и ширина фаски. Поднимать
      // следствия по отдельности значит собирать состояние, которого у стекла не бывает.
      // Материал детали собирается ИЗ ЯДРА, а не по месту: несёт ли она краску и активна ли
      // она — вопросы к материалу, и ответ на них обязан быть один на вебе и на Android.
      optics: resolveOptics({
        ...activeMaterial(materialForInk(BUTTON_MATERIAL, Boolean(spot.row.content)), on),
        ink: buttonInk[i],
      }),
      geometry: spot.row.width
        ? roundedRectGeometry(spot.row.width, spot.row.size, spot.row.radius ?? spot.row.size / 2)
        : circleGeometry(spot.row.size),
      // Кнопки принадлежат ЭКРАНУ, а не кадру: полотно тянут — они едут вместе с ним.
      centerX: spot.x * dpr,
      centerY: spot.y * dpr,
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
      inkIdle: light ? [0.72, 0.76, 0.82, 1] : [0.24, 0.26, 0.3, 1],
      inkActive: light ? [1, 1, 1, 1] : [0.05, 0.06, 0.08, 1],
    };
  });
}

function renderFrame() {
  const ink = manualInk ? material.ink : polarity === 'тёмная' ? INK_DARK : INK_LIGHT;
  const zone = ZONES[state.zone].draw;
  const screens = state.view === 'screens';
  return renderer.render({
    density: dpr,
    debug: DEBUG_MODES[state.debug] as VireGlassDebugMode,
    scene: screens
      ? (ctx, w, h, ox, oy) => {
          zone(ctx, w, h, ox, oy);
          drawAppBackground(ctx, dpr, APP_SCREEN, ox, oy, accentHue);
          drawAppBackground(ctx, dpr, NAV_SCREEN, ox, oy, accentHue);
          // Список — обычный контент, и живёт он В ПОЛОТНЕ, под линзами: стекло обязано его
          // преломлять, иначе плашка висит не над экраном, а рядом с ним.
          drawRecentList(ctx, dpr, NAV_SCREEN, ox, oy, listScroll);
          drawPhoneFrames(ctx, dpr, PHONE_COUNT, ox, oy);
        }
      : zone,
    offsetX: offset.x * dpr,
    offsetY: offset.y * dpr,
    iconMask: screens ? updateIconMask() : null,
    colorLayer: screens ? updateColorLayer() : null,
    pieces: screens ? buttonPieces() : [controlPiece(), ...samplePieces(ink)],
  });
}

function applyPolarity(sample: { luma: number; hi: number }): void {
  if (manualInk) return;
  const light = shouldInkBeLight(sample, optics.legibility, polarity === 'светлая');
  const next = light ? 'светлая' : 'тёмная';
  // Замер зонда приходит с отставанием, и полярность может смениться на ПОСЛЕДНЕМ кадре
  // досчёта. Без побудки состояние уже новое, а на экране остаётся кадр со старой полярностью.
  if (next !== polarity) wake();
  polarity = next;
  optics = resolveOptics({ ...material, ink: light ? INK_LIGHT : INK_DARK });
}

function describe(probe: { luma: number; busy: number; lo: number; hi: number } | null): string {
  const presetName = state.preset >= 0 ? PRESET_NAMES[state.preset] : 'база';
  return (
    `${canvas.width}×${canvas.height} · zone=${state.zone}(${ZONE_NAMES[state.zone]}) · ` +
    `preset=${presetName} · debug=${state.debug}(${DEBUG_MODES[state.debug]}) · надпись ${polarity}\n` +
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
  // Шагают ВСЕ деформации: кнопок четыре, и каждая живёт своей пружиной.
  deform.step(dt);
  for (const d of buttonDeforms) d.step(dt);
  const activeMoving = stepButtonActive(dt);
  if (activeMoving || stepProgress(dt) || !deform.idle() || buttonDeforms.some((d) => !d.idle())) {
    wake();
  }
  if (pending <= 0) return;
  const probes = renderFrame().probes;
  const probe = probes[0];
  if (state.view === 'screens') updateButtonInk(probes);
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
let listScroll = 0;

function scrollList(dy: number): void {
  const next = Math.min(Math.max(listScroll + dy, 0), recentScrollMax());
  if (next === listScroll) return;
  listScroll = next;
  pending = SETTLE_FRAMES;
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
    if (state.view === 'screens' && screenUnder(event.clientX, event.clientY) === NAV_SCREEN) {
      scrollList(event.deltaY / dpr);
      return;
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
};

/** Какая деталь под пальцем — в обоих режимах, с запасом, чтобы не мазать по кромке. */
function pickTarget(clientX: number, clientY: number): Target | null {
  if (state.view === 'screens') {
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
  if (!gesture) {
    canvas.style.cursor = pickTarget(event.clientX, event.clientY) ? 'pointer' : 'grab';
    return;
  }
  if (gesture.target) {
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
  if (gesture.target) {
    gesture.target.deform.release(WAVE_ON_RELEASE);
    // Клик — это жест без протяжки: тянули дальше порога, значит переключать нечего.
    const moved = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
    const index = gesture.target.index;
    if (index !== undefined && moved < 6) {
      toggleButton(index, gesture.target.localX, gesture.target.localY);
    }
    wake();
  }
  gesture = null;
  canvas.style.cursor = 'grab';
};
canvas.addEventListener('pointerup', endGesture);
canvas.addEventListener('pointercancel', endGesture);

placeCaptions();

// Значки приходят из спрайта асинхронно — как пришли, кадр перерисовывается с ними.
void loadIcons([...NAV_ICONS, ...PLAYER_ICONS]).then(() => wake());

requestAnimationFrame(tick);

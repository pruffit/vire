/**
 * СВЕРОЧНЫЕ ПОЛОТНА — набор, который рисуют ОБА стенда и по которому идут гейты.
 *
 * Раньше полотен было три вида и все в разных местах: свои зоны у веб-стенда, свои у мобильной
 * лаборатории, и третьи — внутри `check-optics.mjs`, где их не видел никто. Поэтому гейт мерил
 * одно, глаз смотрел на другое, а вопрос «на Android иначе?» подтвердить было нечем.
 *
 * Полотна описаны ДАННЫМИ, а не кодом отрисовки: канвас и вьюхи рисуют по-разному, а список
 * слоёв обе платформы кладут одинаково. Всё в dp и в долях — доли площадки делали полосы разной
 * толщины на стендах разного размера.
 *
 * Каждое полотно отвечает за своё обещание материала (`what`), и это же подпись на стенде.
 * Добавлять полотно только в один стенд нельзя: сверка платформ снова станет впечатлением.
 */

import { capsuleGeometry, circleGeometry, roundedRectGeometry, type VireGlassGeometry } from './geometry';

/**
 * ФИГУРЫ СТЕНДОВ — тоже общие. Размер детали входит в оптику через sizeGain: круг 120 и круг
 * 150 это стекло разной толщины, и снимки двух стендов на разных фигурах несравнимы так же,
 * как на разных полотнах. Значения совпадают с теми, на которых сняты сверки с эталоном.
 */
export const REFERENCE_SHAPES = {
  круг: circleGeometry(120),
  капсула: capsuleGeometry(300, 110),
  плашка: roundedRectGeometry(220, 120, 32),
} satisfies Record<string, VireGlassGeometry>;

export type VireGlassRefShapeName = keyof typeof REFERENCE_SHAPES;

/** Слой полосы. Светлоты — 0…1, размеры — dp: серый, а не цвет (цвет мерить нечем). */
export type VireGlassRefLayer =
  | { readonly kind: 'заливка'; readonly level: number }
  /** Вертикальные полосы: шире фаски, чтобы их гасило тело, а не кромка. */
  | { readonly kind: 'полосы'; readonly level: number; readonly other: number; readonly periodDp: number; readonly widthDp: number }
  /** Псевдослучайная шахматка — «обложка»: структура, с которой спорит краска поверх стекла. */
  | { readonly kind: 'шахматка'; readonly level: number; readonly amp: number; readonly cellDp: number }
  /** Левая и правая половины разной светлоты. */
  | { readonly kind: 'ступень'; readonly left: number; readonly right: number }
  /** Тёмная черта поперёк полосы по центру — на ней меряется раздув у кромки. */
  | { readonly kind: 'черта'; readonly level: number; readonly barLevel: number; readonly thicknessDp: number }
  /** Тонкая клетка: любое искажение линзы видно на прямой линии сразу. */
  | { readonly kind: 'сетка'; readonly level: number; readonly lineLevel: number; readonly stepDp: number }
  /** Ступенчатый градиент. Ступеней, а не гладкой заливки: вьюхи не умеют градиент без картинки. */
  | { readonly kind: 'градиент'; readonly from: number; readonly to: number; readonly steps: number };

export type VireGlassRefBand = {
  /** Толщина полосы в dp. Сумма по полотну — `REFERENCE_SCENE_HEIGHT`. */
  readonly heightDp: number;
  readonly layer: VireGlassRefLayer;
};

/**
 * Габарит полотна В DP, один на все. Высота держится в зоне мобильной лаборатории (0.42 высоты
 * экрана), ширина — в самом узком телефоне (360 dp) с запасом на поле окружения.
 *
 * Ширина задана НЕ МЕНЕЕ ВАЖНО, чем высота. Узор отсчитывается от края полотна, поэтому на
 * полотне во всю ширину площадки фаза под деталью зависела от ширины экрана: полосы с шагом
 * 24 dp приходили под середину по-разному на телефоне 406 dp и на канвасе в полторы тысячи, а
 * у шахматки под деталью оказывалась вообще другая расстановка клеток. Панель фиксированного
 * размера убирает весь этот класс расхождений разом.
 */
export const REFERENCE_SCENE_WIDTH = 336;
export const REFERENCE_SCENE_HEIGHT = 252;

/** Поле вокруг полотна. Заведомо мимо уровней полос и не серое: по нему видно, где кончается
 *  сверочная область, и на снимке её границу не спутать с полосой. */
export const REFERENCE_SURROUND = '#3c1f4a';

/**
 * Где на полотне стоит деталь — dp от левого верхнего угла панели. Положение такая же часть
 * контракта, как размер полотна и фигуры: стенд, который паркует деталь по-своему, показывает
 * её над ДРУГИМИ полосами, и сравнивать снимки нечем.
 *
 * Так уже разъезжалось: веб-стенд ставил деталь по центру ВИДИМОЙ области, а полотно рисовал по
 * центру канваса — с открытой панелью управления это две разные точки.
 */
export const REFERENCE_PIECE_AT = {
  xDp: REFERENCE_SCENE_WIDTH / 2,
  yDp: REFERENCE_SCENE_HEIGHT / 2,
} as const;

export type VireGlassRefScene = {
  readonly name: string;
  /** Что этим полотном проверяется. Оно же подпись на стенде — иначе набор превращается в кашу. */
  readonly what: string;
  /** Полосы при заданной светлоте фона: стенды зовут с `level`, гейт — по всему диапазону. */
  readonly bands: (level: number) => readonly VireGlassRefBand[];
  /** Светлота по умолчанию. Полотна, которым она не нужна, просто её игнорируют. */
  readonly level: number;
  /**
   * Годится ли полотно для ЧИСЛЕННОЙ сверки платформ. Профиль светлоты требует фона, одинаково
   * устроенного вдоль строки; на периодической решётке из линий в пиксель среднее определяется
   * тем, как платформа эту линию растрирует, а не материалом. Такое полотно остаётся в наборе —
   * искажение прямой линии видно глазом сразу, — но в таблицу сверки не идёт.
   */
  readonly measurable?: false;
};

const whole = (layer: VireGlassRefLayer): readonly VireGlassRefBand[] => [
  { heightDp: REFERENCE_SCENE_HEIGHT, layer },
];

/** Контраст полос одинаков на всех уровнях, чтобы пропускание сравнивалось между шагами честно. */
const stripeLevel = (level: number) => (level < 0.5 ? level + 0.22 : level - 0.22);

export const REFERENCE_SCENES: readonly VireGlassRefScene[] = [
  {
    name: 'ровное',
    what: 'отход тела от фона: деталь обязана быть видна над ровным полотном',
    level: 0.5,
    bands: (level) => whole({ kind: 'заливка', level }),
  },
  {
    name: 'полосы',
    what: 'окно: размах яркости внутри детали — заметная доля размаха снаружи',
    level: 0.5,
    bands: (level) => whole({ kind: 'полосы', level, other: stripeLevel(level), periodDp: 24, widthDp: 10 }),
  },
  {
    name: 'пёстрое',
    what: 'краска против контента: над обложкой живут и надпись, и то, что под стеклом',
    level: 0.5,
    bands: (level) => whole({ kind: 'шахматка', level, amp: 0.28, cellDp: 16 }),
  },
  {
    name: 'черта',
    what: 'кромка копит содержимое: у силуэта линза раздувает то, что за ней',
    level: 0.93,
    bands: (level) => whole({ kind: 'черта', level, barLevel: 0.12, thicknessDp: 20 }),
  },
  {
    name: 'ступени',
    what: 'профиль тела сразу на пяти уровнях — по нему сверяются платформы',
    level: 0.5,
    bands: () => [
      { heightDp: 36, layer: { kind: 'заливка', level: 0.1 } },
      { heightDp: 36, layer: { kind: 'заливка', level: 0.3 } },
      { heightDp: 36, layer: { kind: 'заливка', level: 0.5 } },
      { heightDp: 36, layer: { kind: 'заливка', level: 0.69 } },
      { heightDp: 36, layer: { kind: 'заливка', level: 0.9 } },
      { heightDp: 36, layer: { kind: 'ступень', left: 0.05, right: 0.28 } },
      { heightDp: 36, layer: { kind: 'черта', level: 0.92, barLevel: 0.12, thicknessDp: 6 } },
    ],
  },
  {
    name: 'граница',
    what: 'тинт на изломе: одна половина под стеклом чёрная, другая белая',
    level: 0.5,
    bands: () => whole({ kind: 'ступень', left: 0.03, right: 0.95 }),
  },
  {
    name: 'градиент',
    what: 'полярность краски: где автоматика перекидывает надпись со светлой на тёмную',
    level: 0.5,
    bands: () => whole({ kind: 'градиент', from: 0.04, to: 0.96, steps: 28 }),
  },
  {
    name: 'сетка',
    what: 'искажения линзы: увод, разрыв и дрожание прямой линии видно сразу (глазом, не числом)',
    level: 0.91,
    measurable: false,
    bands: (level) => whole({ kind: 'сетка', level, lineLevel: level > 0.5 ? level - 0.14 : level + 0.14, stepDp: 12 }),
  },
];

export type VireGlassRefSceneName = (typeof REFERENCE_SCENES)[number]['name'];

export const referenceScene = (name: string): VireGlassRefScene => {
  const scene = REFERENCE_SCENES.find((s) => s.name === name);
  if (!scene) throw new Error(`vireglass: сверочного полотна «${name}» нет`);
  return scene;
};

/** Светлота в шестнадцатеричный серый. Один перевод на обе платформы — иначе разойдутся. */
export const refGray = (level: number): string => {
  const v = Math.round(Math.min(Math.max(level, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${v}${v}${v}`;
};

/**
 * Клетки шахматки как ПОЗИЦИИ, а не как рисование: канвас обойдёт их циклом, вьюхи разложат
 * списком, и обе платформы получат одну и ту же расстановку. Генератор свой и простейший —
 * `Math.random` дал бы на двух платформах разные полотна.
 */
export const refCheckerCells = (
  layer: Extract<VireGlassRefLayer, { kind: 'шахматка' }>,
  widthDp: number,
  heightDp: number,
): readonly { readonly xDp: number; readonly yDp: number; readonly level: number }[] => {
  const cells: { xDp: number; yDp: number; level: number }[] = [];
  const lo = layer.level - layer.amp;
  const hi = layer.level + layer.amp;
  let seed = 1;
  for (let y = 0; y < heightDp; y += layer.cellDp) {
    for (let x = 0; x < widthDp; x += layer.cellDp) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      cells.push({ xDp: x, yDp: y, level: (seed >> 16) % 2 ? hi : lo });
    }
  }
  return cells;
};

/** Ступени градиента — тоже позиции: тот же список у канваса и у вьюх. */
export const refGradientSteps = (
  layer: Extract<VireGlassRefLayer, { kind: 'градиент' }>,
): readonly number[] =>
  Array.from({ length: layer.steps }, (_, i) =>
    layer.from + ((layer.to - layer.from) * i) / Math.max(layer.steps - 1, 1),
  );

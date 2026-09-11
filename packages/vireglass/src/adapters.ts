import {
  bevelDp,
  bevelFraction,
  halfMinDp,
  rimDp,
  shadowReachDp,
  surfacePadDp,
  thicknessDp,
  type VireGlassGeometry,
} from './geometry';
import { LENS_SHADER } from './lens-shader';
import { debugIndex, type VireGlassDebugMode, type VireGlassOptics } from './material';

/** Гладкое объединение со второй формой — только морфинг-эксперимент стенда. */
export type VireGlassMorph = {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  cornerRadius: number;
  /** Радиус сглаживания стыка в dp; 0 — вторая форма выключена. */
  smoothing: number;
};


/** Отклик поверхности на палец: деформируется поле вокруг точки касания, а не габарит формы
 *  (`vgTouchWarp` в `sdf.ts`). Длины в dp; `radius` = 0 выключает отклик целиком. */
export type VireGlassTouch = {
  x: number;
  y: number;
  pullX: number;
  pullY: number;
  press: number;
  radius: number;
  waveAmp: number;
  wavePhase: number;
};

const NO_TOUCH: VireGlassTouch = {
  x: 0, y: 0, pullX: 0, pullY: 0, press: 0, radius: 0, waveAmp: 0, wavePhase: 0,
};

const NO_MORPH = { offsetX: 0, offsetY: 0, width: 0, height: 0, cornerRadius: 0, smoothing: 0 };

/** Прогресса нет. Отрицательным, а не нулём: ноль — это начало трека, законное значение. */
const NO_PROGRESS = -1;

/** Цветное стекло главного действия (M 16:08). Цвет — RGB 0…1. */
export type VireGlassAccent = { color: readonly [number, number, number]; amount?: number };

/** Доля тонирования по умолчанию: цвет читается, но контент под ним ещё виден. */
export const ACCENT_AMOUNT = 0.8;
const NO_ACCENT = [0, 0, 0, 0] as const;



/** Увеличение в плоской середине. Отдельно от канала униформ: его же берёт фолбэк ниже
 *  Android 13, где оптики нет и остаётся аффинная лупа. */
export const lensMagnify = (o: VireGlassOptics) => 1 + (o.refractionScale - 1) * o.refraction;

/**
 * Униформы линзы. Собираются ОДНИМ каналом: имя, размер и значения уезжают вместе, поэтому
 * несовпадение с шейдером ловится сразу и с именем в логе. Раньше на каждую величину был
 * свой `Prop` в Kotlin — неизвестный проп Expo проглатывает молча, и линза просто не
 * включалась (material-lab.md E-01, из-за этого преломление было выключено целую фазу).
 *
 * Всё, что имеет размерность, переводится в ПИКСЕЛИ здесь. У нативной вьюхи остаются только
 * те униформы, которые знает она одна: свой размер и своё место на экране.
 */
// Имена и размеры у линзы всегда одни и те же — набор униформ фиксирован. Отдаём их ОДНИМ
// экземпляром на весь процесс: иначе каждый кадр перетаскивания шлёт на нативную сторону
// три десятка новых строк, React не может отличить «не изменилось» от нового массива, и
// движение идёт ступенями. Значения — единственное, что действительно меняется.
const shapes = new Map<number, { names: string[]; sizes: number[] }>();

function channel(entries: [string, number | readonly number[]][]) {
  const uniformValues: number[] = [];
  let shape = shapes.get(entries.length);
  let same = shape !== undefined;
  for (let i = 0; i < entries.length; i += 1) {
    const [name, value] = entries[i];
    const v = typeof value === 'number' ? [value] : value;
    if (same && (shape!.names[i] !== name || shape!.sizes[i] !== v.length)) same = false;
    for (const x of v) uniformValues.push(x);
  }
  if (!same) {
    shape = {
      names: entries.map((e) => e[0]),
      sizes: entries.map((e) => (typeof e[1] === 'number' ? 1 : e[1].length)),
    };
    shapes.set(entries.length, shape);
  }
  return { uniformNames: shape!.names, uniformSizes: shape!.sizes, uniformValues };
}

/** Пропы нативной вьюхи. Кроме канала униформ здесь только то, что вьюха использует сама:
 *  исходник шейдера и габарит видимого стекла (по нему берётся прямоугольник зонда). */
export function toLensProps(
  optics: VireGlassOptics,
  geometry: VireGlassGeometry,
  density: number,
  options: {
    debug?: VireGlassDebugMode;
    morph?: VireGlassMorph;
    /** Третья форма слитого тела; ноль размера её выключает. */
    morph2?: VireGlassMorph;
    groupProbe?: number[];
    touch?: VireGlassTouch;
    /** Сыгранная доля, 0…1: слева от границы деталь активна. `undefined` — прогресса нет. */
    progress?: number;
    /** Направление ключевого света в плоскости экрана; по умолчанию — свет в покое. */
    light?: readonly [number, number];
    /** 0…1: линза нарастает при появлении детали — вместо прозрачности. */
    appear?: number;
    /** Тонирование главного действия: цвет стекла и доля, в которой он ложится на контент. */
    accent?: VireGlassAccent;
  } = {},
) {
  const morph = options.morph ?? NO_MORPH;
  const morph2 = options.morph2 ?? NO_MORPH;
  const touch = options.touch ?? NO_TOUCH;
  // Оценка фона на всю группу поверхностей. Едет тем же каналом, что и материал, и
  // применяется ПОСЛЕ собственной оценки линзы — то есть просто перебивает её. Отдельным
  // пропом это не поедет: вьюха линзы обёрнута анимированным компонентом.
  const g = options.groupProbe;
  const group: [string, number | readonly number[]][] =
    g && g.length >= 9
      ? [
          ['u_probeLuma', g[0]],
          ['u_probeBusy', g[1]],
          ['u_probeRange', [g[2], g[3]]],
          ['u_probeSlope', [g[4], g[5]]],
          ['u_probe', [g[6], g[7], g[8]]],
        ]
      : [];
  const d = density;
  const halfW = (geometry.width * d) / 2;
  const halfH = (geometry.height * d) / 2;
  const halfMin = Math.min(halfW, halfH);

  return {
    shaderSource: LENS_SHADER,
    glassWidth: geometry.width,
    glassHeight: geometry.height,
    ...channel([
      ['u_halfSize', [halfW, halfH]],
      ['u_corner', Math.min(geometry.cornerRadius * d, halfMin)],
      ['u_bevel', Math.max(bevelDp(geometry, optics) * d, 1)],
      ['u_thick', thicknessDp(geometry, optics) * d],
      ['u_rim', rimDp(geometry, optics) * d],
      ['u_ior', optics.ior],
      ['u_iorSpread', optics.iorSpread],
      ['u_light', options.light ?? REST_LIGHT],
      ['u_appear', options.appear ?? 1],
      ['u_accent', options.accent ? [...options.accent.color, options.accent.amount ?? ACCENT_AMOUNT] : NO_ACCENT],
      // Мутность от шероховатости поверхности. Живёт в том же дисковом сборе, что и
      // адаптивное рассеяние, и гасится к фаске: там работа другая — гнуть луч и расщеплять.
      ['u_frost', optics.blur * d],
      ['u_ink', optics.ink],
      ['u_legibility', optics.legibility],
      ['u_presence', optics.presence],
      ['u_adaptRadius', optics.adaptRadius * d],
      ['u_bodyDensity', optics.bodyDensity],
      ['u_edgeLight', optics.edgeLight],
      ['u_fresnel', optics.fresnel],
      ['u_specular', optics.specular],
      // Кромка собирает свет в окрестности детали — это радиус вокруг формы, а не её фаска.
      ['u_reflectReach', optics.gatherRadiusDp * d],
      ['u_film', optics.film],
      ['u_iridescence', optics.iridescence],
      ['u_diffraction', optics.diffraction],
      ['u_colorPickup', optics.colorPickup],
      ['u_morphOffset', [morph.offsetX * d, morph.offsetY * d]],
      ['u_morphHalf', [(morph.width * d) / 2, (morph.height * d) / 2]],
      ['u_morphCorner', morph.cornerRadius * d],
      ['u_morphK', morph.smoothing * d],
      ['u_morph2Offset', [morph2.offsetX * d, morph2.offsetY * d]],
      ['u_morph2Half', [(morph2.width * d) / 2, (morph2.height * d) / 2]],
      ['u_morph2Corner', morph2.cornerRadius * d],
      ['u_touch', [touch.x * d, touch.y * d]],
      ['u_pull', [touch.pullX * d, touch.pullY * d]],
      ['u_touchPress', touch.press],
      ['u_touchRadius', touch.radius * d],
      ['u_wave', [touch.waveAmp * d, touch.wavePhase]],
      ['u_progress', options.progress ?? NO_PROGRESS],
      ['u_debug', debugIndex(options.debug ?? 'normal')],
      ...group,
    ]),
  };
}

/** Статическая часть униформ поверхности. Динамика (жест, нажатие, свет) домешивается
 *  в ворклете компонента — адаптер обязан оставаться обычной функцией. */
export function toSurfaceUniforms(
  optics: VireGlassOptics,
  geometry: VireGlassGeometry,
  options: {
    debug?: VireGlassDebugMode;
    morph?: VireGlassMorph;
    /** Третья форма слитого тела; ноль размера её выключает. */
    morph2?: VireGlassMorph;
    dragLimit?: number;
    shadow?: number;
    /** Тело стекла рисует линза — поверхности остаётся блик, тень и иконка. */
    bodyInLens?: boolean;
    touch?: VireGlassTouch;
    /** Сыгранная доля, 0…1: слева от границы деталь активна. `undefined` — прогресса нет. */
    progress?: number;
    /** 0…1: деталь появляется — тень и краска нарастают вместе с линзой. */
    appear?: number;
  } = {},
) {
  const morph = options.morph ?? NO_MORPH;
  const morph2 = options.morph2 ?? NO_MORPH;
  const touch = options.touch ?? NO_TOUCH;
  const pad = surfacePadDp(geometry, options.dragLimit ?? 0, morph);
  return {
    u_center: [geometry.width / 2 + pad, geometry.height / 2 + pad],
    u_halfSize: [geometry.width / 2, geometry.height / 2],
    u_corner: Math.min(geometry.cornerRadius, halfMinDp(geometry)),
    u_bevel: bevelDp(geometry, optics),
    u_thickness: bevelFraction(geometry, optics),
    u_morphOffset: [morph.offsetX, morph.offsetY],
    u_morphHalf: [morph.width / 2, morph.height / 2],
    u_morphCorner: morph.cornerRadius,
    u_morphK: morph.smoothing,
    u_morph2Offset: [morph2.offsetX, morph2.offsetY],
    u_morph2Half: [morph2.width / 2, morph2.height / 2],
    u_morph2Corner: morph2.cornerRadius,
    u_specular: optics.specular,
    u_specularPower: optics.specularPower,
    u_edgeDensity: optics.edgeDensity,
    u_dispersion: optics.dispersion,
    u_refraction: optics.refraction,
    // Плотность тинта гасится, когда тело считает линза: рисовать его дважды значит
    // получить двойную заливку, а адаптация у поверхности всё равно невозможна — фона она
    // не видит. Сам цвет остаётся: по нему идёт поглощение у кромки.
    u_tint: [
      optics.tint.r,
      optics.tint.g,
      optics.tint.b,
      options.bodyInLens ? 0 : optics.tintStrength,
    ],
    u_shadow: options.shadow ?? 1,
    u_shadowReach: shadowReachDp(geometry),
    u_touch: [touch.x, touch.y],
    u_pull: [touch.pullX, touch.pullY],
    u_touchPress: touch.press,
    u_touchRadius: touch.radius,
    u_wave: [touch.waveAmp, touch.wavePhase],
    u_presence: optics.presence,
    u_progress: options.progress ?? NO_PROGRESS,
    u_appear: options.appear ?? 1,

    u_debug: debugIndex(options.debug ?? 'normal'),
  };
}

/** Направление ключевого света в экранных координатах, когда отклик на ориентацию выключен. */
export const REST_LIGHT: readonly [number, number] = [-0.577, -0.817];

/** Униформы, которые компонент домешивает в ворклете (нажатие, активность, направление
 *  света) и слоем иконки. Перечислены здесь, чтобы тест мог проверить полноту контракта
 *  шейдера без импорта самого компонента (он тянет Skia и в node-окружении не поднимается). */
export const DYNAMIC_UNIFORMS = ['u_press', 'u_active', 'u_light'] as const;

export const ICON_UNIFORMS = ['u_iconOn', 'u_iconScale', 'u_inkIdle', 'u_inkActive'] as const;

/** Цветной слой приложения на стекле. Сэмплер `u_overlay` живёт в том же контракте, что и
 *  маска краски, и берётся ТОЙ ЖЕ координатой — иначе деформация ведёт их порознь. */
export const OVERLAY_UNIFORMS = ['u_overlayOn'] as const;

/**
 * Слияние двух поверхностей в одну непрерывную среду.
 *
 * Вторая форма описывается ОТНОСИТЕЛЬНО центра первой, потому что обе живут в одном шейдере:
 * у объединения нет «двух стёкол», есть одно тело с двумя выпуклостями — и маска, и
 * преломление, и кромка считаются по общей сцене.
 *
 * `t` — насколько формы слиты: 0 отключает вторую форму до всех вычислений, 1 даёт общую
 * среду. Радиус сглаживания стыка берётся долей меньшего полуразмера: у крупных деталей
 * перемычка обязана быть шире, иначе на стыке остаётся острый угол, которого у жидкости
 * не бывает.
 */
const MORPH_NECK = 0.35;

export function morphBetween(
  a: VireGlassGeometry,
  b: VireGlassGeometry,
  offsetX: number,
  offsetY: number,
  t: number,
): VireGlassMorph | undefined {
  if (t <= 0) return undefined;
  const half = Math.min(halfMinDp(a), halfMinDp(b));
  return {
    offsetX,
    offsetY,
    width: b.width,
    height: b.height,
    cornerRadius: b.cornerRadius,
    smoothing: half * MORPH_NECK * Math.min(t, 1),
  };
}

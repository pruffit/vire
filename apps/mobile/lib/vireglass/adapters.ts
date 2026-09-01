import { PixelRatio } from 'react-native';
import {
  bevelDp,
  bevelFraction,
  chromaDp,
  edgePushDp,
  halfMinDp,
  shadowReachDp,
  sphericalDp,
  surfacePadDp,
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

const NO_MORPH = { offsetX: 0, offsetY: 0, width: 0, height: 0, cornerRadius: 0, smoothing: 0 };

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
  options: { debug?: VireGlassDebugMode; morph?: VireGlassMorph; groupProbe?: number[] } = {},
) {
  const morph = options.morph ?? NO_MORPH;
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
  const d = PixelRatio.get();
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
      ['u_magnify', lensMagnify(optics)],
      ['u_edgePush', edgePushDp(geometry, optics) * d],
      ['u_chroma', chromaDp(geometry, optics) * d],
      ['u_spherical', sphericalDp(geometry, optics) * d],
      // Мутность от шероховатости поверхности. Живёт в том же дисковом сборе, что и
      // адаптивное рассеяние, и гасится к фаске: там работа другая — гнуть луч и расщеплять.
      ['u_frost', optics.blur * d],
      ['u_ink', optics.ink],
      ['u_legibility', optics.legibility],
      ['u_adaptRadius', optics.adaptRadius * d],
      ['u_bodyTint', [optics.tint.r, optics.tint.g, optics.tint.b]],
      ['u_bodyDensity', optics.bodyDensity],
      ['u_edgeLight', optics.edgeLight],
      ['u_fresnel', optics.fresnel],
      ['u_fresnelPower', optics.fresnelPower],
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
    dragLimit?: number;
    shadow?: number;
    /** Тело стекла рисует линза — поверхности остаётся блик, тень и иконка. */
    bodyInLens?: boolean;
  } = {},
) {
  const morph = options.morph ?? NO_MORPH;
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
    u_debug: debugIndex(options.debug ?? 'normal'),
  };
}

/** Направление ключевого света в экранных координатах, когда отклик на ориентацию выключен. */
export const REST_LIGHT: readonly [number, number] = [-0.577, -0.817];

/** Униформы, которые компонент домешивает в ворклете (жест, нажатие, направление света)
 *  и слоем иконки. Перечислены здесь, чтобы тест мог проверить полноту контракта шейдера
 *  без импорта самого компонента (он тянет Skia и в node-окружении не поднимается). */
export const DYNAMIC_UNIFORMS = [
  'u_shift',
  'u_dir',
  'u_stretch',
  'u_press',
  'u_active',
  'u_light',
] as const;

export const ICON_UNIFORMS = ['u_iconOn', 'u_iconScale', 'u_inkIdle', 'u_inkActive'] as const;

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

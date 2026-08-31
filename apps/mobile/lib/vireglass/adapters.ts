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

/** Пропы нативной вьюхи. Имена обязаны совпадать с `Prop("…")` в `GlassLensModule.kt` —
 *  расхождение Expo проглатывает молча, и линза просто не включается (см. тест паритета). */
export function toLensProps(
  optics: VireGlassOptics,
  geometry: VireGlassGeometry,
  options: { debug?: VireGlassDebugMode; morph?: VireGlassMorph } = {},
) {
  const morph = options.morph ?? NO_MORPH;
  return {
    shaderSource: LENS_SHADER,
    glassWidth: geometry.width,
    glassHeight: geometry.height,
    cornerRadius: geometry.cornerRadius,
    bevel: bevelFraction(geometry, optics),
    magnify: 1 + (optics.refractionScale - 1) * optics.refraction,
    edgePush: edgePushDp(geometry, optics),
    chroma: chromaDp(geometry, optics),
    spherical: sphericalDp(geometry, optics),
    // ВЫКЛЮЧЕНО. Своё размытие уводит выборку в площадной сбор: дисперсия там не считается
    // вовсе, а по всему телу появляется смаз, которого в центре быть не должно, — оптика
    // становится вялой. Зерно снято самим захватом, размытие тут больше не нужно.
    frost: 0,
    ink: optics.ink,
    legibility: optics.legibility,
    adaptRadius: optics.adaptRadius,
    bodyDensity: optics.bodyDensity,
    edgeLight: optics.edgeLight,
    // Оттенок среды уезжает тремя числами: пропы нативной вьюхи плоские.
    bodyTintR: optics.tint.r,
    bodyTintG: optics.tint.g,
    bodyTintB: optics.tint.b,
    fresnel: optics.fresnel,
    fresnelPower: optics.fresnelPower,
    // Кромка собирает свет в окрестности детали — это радиус вокруг формы, а не её фаска.
    reflectReach: optics.gatherRadiusDp,
    morphX: morph.offsetX,
    morphY: morph.offsetY,
    morphWidth: morph.width,
    morphHeight: morph.height,
    morphCorner: morph.cornerRadius,
    morphSmoothing: morph.smoothing,
    debug: debugIndex(options.debug ?? 'normal'),
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

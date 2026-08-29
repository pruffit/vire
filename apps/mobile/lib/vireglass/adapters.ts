import {
  bevelDp,
  chromaDp,
  edgePushDp,
  halfMinDp,
  shadowReachDp,
  sphericalDp,
  surfacePadDp,
  type VireGlassGeometry,
} from './geometry';
import { LENS_SHADER } from './lens-shader';
import { debugIndex, type VireGlassDebugMode, type VireGlassMaterial } from './material';

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
  material: VireGlassMaterial,
  geometry: VireGlassGeometry,
  options: { debug?: VireGlassDebugMode; morph?: VireGlassMorph } = {},
) {
  const morph = options.morph ?? NO_MORPH;
  return {
    shaderSource: LENS_SHADER,
    glassWidth: geometry.width,
    glassHeight: geometry.height,
    cornerRadius: geometry.cornerRadius,
    bevel: material.thickness,
    magnify: 1 + (material.refractionScale - 1) * material.refraction,
    edgePush: edgePushDp(geometry, material),
    chroma: chromaDp(geometry, material),
    spherical: sphericalDp(geometry, material),
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
  material: VireGlassMaterial,
  geometry: VireGlassGeometry,
  options: { debug?: VireGlassDebugMode; morph?: VireGlassMorph; dragLimit?: number; shadow?: number } = {},
) {
  const morph = options.morph ?? NO_MORPH;
  const pad = surfacePadDp(geometry, options.dragLimit ?? 0, morph);
  return {
    u_center: [geometry.width / 2 + pad, geometry.height / 2 + pad],
    u_halfSize: [geometry.width / 2, geometry.height / 2],
    u_corner: Math.min(geometry.cornerRadius, halfMinDp(geometry)),
    u_bevel: bevelDp(geometry, material),
    u_thickness: material.thickness,
    u_morphOffset: [morph.offsetX, morph.offsetY],
    u_morphHalf: [morph.width / 2, morph.height / 2],
    u_morphCorner: morph.cornerRadius,
    u_morphK: morph.smoothing,
    u_fresnel: material.fresnel,
    u_fresnelPower: material.fresnelPower,
    u_specular: material.specular,
    u_specularPower: material.specularPower,
    u_edgeStrength: material.edgeStrength,
    u_edgeWidth: material.edgeWidth,
    u_dispersion: material.dispersion,
    u_refraction: material.refraction,
    u_tint: [material.tint.r, material.tint.g, material.tint.b, material.tintStrength],
    u_opacity: material.opacity,
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

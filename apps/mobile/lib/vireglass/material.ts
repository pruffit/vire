// Модель материала VireGlass.
//
// Два разных объекта, и путать их нельзя:
//
//   VireGlassMaterial — ПРИЧИНЫ. То, чем описывают кусок стекла: показатель преломления,
//                       толщина, ширина фаски, шероховатость, цвет поглощения. Это то, что
//                       настраивают.
//   VireGlassOptics   — СЛЕДСТВИЯ. Восемнадцать величин, которые нужны шейдерам. Их не
//                       настраивают: они выводятся (`resolveOptics`, физика в `optics.ts`).
//
// До v4 наружу торчали именно следствия — восемнадцать независимых ползунков. Половина из
// них физически зависима, поэтому из них собирались состояния, которых в стекле не бывает:
// тонкая фаска с плотной белой кромкой, краевая оптика долей габарита детали. Каждое такое
// лечилось добавлением ещё одного ползунка (`edgeDensity`, компенсация размера) — то есть
// компенсацией отсутствующей физики. Здесь причина одна, следствия выводятся.

import {
  absorption,
  blur as blurFrom,
  dispersion as dispersionFrom,
  edgeDensity as edgeDensityFrom,
  edgePush as edgePushFrom,
  gatherRadius as gatherRadiusFrom,
  fresnelStrength,
  FRESNEL_EXPONENT,
  mediumTint,
  refractionScale as refractionScaleFrom,
  refractionStrength,
  specularPower as specularPowerFrom,
  specularStrength,
} from './optics';

export type VireGlassTint = { r: number; g: number; b: number };

export type VireGlassMaterial = {
  /** Показатель преломления среды. Вода 1.33, стекло 1.5, сапфир 1.77. */
  ior: number;
  /** Толщина стекла, dp. Задаёт увеличение середины и поглощение. */
  thickness: number;
  /** Ширина фаски, dp. Абсолютная: у настоящего стекла кромка не зависит от размера куска. */
  bevel: number;
  /** Шероховатость поверхности: мутность бэкдропа и размытость блика. */
  roughness: number;
  /** Отклик на ориентацию устройства, 0 — свет закреплён к экрану. */
  environment: number;
  /** Не физика, а требование читаемости: выравнивание фона под стеклом. */
  adaptation: number;
};

export const MATERIAL_RANGES = {
  ior: [1, 2],
  thickness: [0, 60],
  bevel: [0, 40],
  roughness: [0, 1],
  environment: [0, 1],
  adaptation: [0, 1],
} as const satisfies Record<string, readonly [number, number]>;

export type VireGlassNumericKey = keyof typeof MATERIAL_RANGES;

/** Целевая светимость фона под стеклом. Порог читаемости, а не вкус — потому константа. */
export const ADAPT_TARGET = 0.42;

/** Затемнение линзы у продуктовых поверхностей — плоская заливка поверх бэкдропа. */
export const PRODUCT_DIM = 0.2;

/** Линза целится в контент напрямую и скрима над таб-баром не видит — гасит себя сама. */
export const SCRIM_COMPENSATION = 0.1;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Величины, которые нужны шейдерам. Собираются из материала, руками не задаются. */
export type VireGlassOptics = {
  blur: number;
  refraction: number;
  refractionScale: number;
  /** Ширина фаски в dp — абсолютная величина среды. */
  bevelDp: number;
  /** Смещение выборки у кромки в dp — тоже от среды, не от габарита детали. */
  edgePushDp: number;
  /** Радиус, в котором кромка собирает свет вокруг детали. */
  gatherRadiusDp: number;
  fresnel: number;
  fresnelPower: number;
  specular: number;
  specularPower: number;
  dispersion: number;
  tint: VireGlassTint;
  tintStrength: number;
  edgeDensity: number;
  environment: number;
  adaptation: number;
  adaptTarget: number;
};

// Продовый дефолт — «вода»: ниже показатель преломления, тоньше среда и фаска, почти
// гладкая поверхность. Выбрано на устройстве в стенде.
export const VIREGLASS_MATERIAL_V4: VireGlassMaterial = {
  ior: 1.33,
  thickness: 14,
  bevel: 5,
  roughness: 0.05,
  environment: 0.27,
  adaptation: 0.26,
};

/** Материал продукта. Потребители берут его, а не версию поимённо. */
export const VIREGLASS_MATERIAL = VIREGLASS_MATERIAL_V4;

export function resolveMaterial(patch: Partial<VireGlassMaterial> = {}): VireGlassMaterial {
  const m = { ...VIREGLASS_MATERIAL, ...patch };
  const out = { ...m };
  for (const key of Object.keys(MATERIAL_RANGES) as VireGlassNumericKey[]) {
    const [lo, hi] = MATERIAL_RANGES[key];
    out[key] = clamp(out[key], lo, hi);
  }
  return out;
}

/** Причины → следствия. Вся физика перехода живёт в `optics.ts`. */
export function resolveOptics(patch: Partial<VireGlassMaterial> = {}): VireGlassOptics {
  const m = resolveMaterial(patch);
  return {
    blur: blurFrom(m.roughness),
    refraction: refractionStrength(m.ior),
    refractionScale: refractionScaleFrom(m.ior, m.thickness),
    bevelDp: m.bevel,
    edgePushDp: edgePushFrom(m.ior, m.bevel),
    gatherRadiusDp: gatherRadiusFrom(m.bevel),
    fresnel: fresnelStrength(m.ior),
    fresnelPower: FRESNEL_EXPONENT,
    specular: specularStrength(m.ior, m.roughness),
    specularPower: specularPowerFrom(m.roughness),
    dispersion: dispersionFrom(m.ior),
    tint: mediumTint(m.ior),
    tintStrength: absorption(m.thickness),
    edgeDensity: edgeDensityFrom(m.thickness, m.bevel),
    environment: m.environment,
    adaptation: m.adaptation,
    adaptTarget: ADAPT_TARGET,
  };
}

/**
 * Замороженные снимки СЛЕДСТВИЙ прежней модели. Держим как опорные точки, пока v4 не
 * устоится: перевести их в причины нельзя — часть значений внутренне несовместима (ровно
 * то, ради чего затевался переход), и любой «эквивалентный» материал был бы враньём.
 */
export const LEGACY_OPTICS = {
  'v3 вручную': {
    blur: 4.32,
    refraction: 0.49,
    refractionScale: 1.05,
    bevelDp: 12.6,
    edgePushDp: 32.7,
    gatherRadiusDp: 40,
    fresnel: 0.77,
    fresnelPower: 2.86,
    specular: 0.3,
    specularPower: 74.58,
    dispersion: 0.54,
    tint: { r: 0.4, g: 0.4, b: 0.44 },
    tintStrength: 0.35,
    edgeDensity: 1.5,
    environment: 0.27,
    adaptation: 0.55,
    adaptTarget: ADAPT_TARGET,
  },
  'v2': {
    blur: 5,
    refraction: 0.95,
    refractionScale: 1.34,
    bevelDp: 14,
    edgePushDp: 30,
    gatherRadiusDp: 40,
    fresnel: 0.72,
    fresnelPower: 2.4,
    specular: 0.38,
    specularPower: 46,
    dispersion: 0.3,
    tint: { r: 0.4, g: 0.4, b: 0.44 },
    tintStrength: 0.1,
    edgeDensity: 3.63,
    environment: 0,
    adaptation: 0,
    adaptTarget: ADAPT_TARGET,
  },
  'v1': {
    blur: 12,
    refraction: 0.55,
    refractionScale: 1.14,
    bevelDp: 10,
    edgePushDp: 22,
    gatherRadiusDp: 40,
    fresnel: 0.5,
    fresnelPower: 3.2,
    specular: 0.42,
    specularPower: 58,
    dispersion: 0.22,
    tint: { r: 0.4, g: 0.4, b: 0.44 },
    tintStrength: 0.16,
    edgeDensity: 3.63,
    environment: 0,
    adaptation: 0,
    adaptTarget: ADAPT_TARGET,
  },
} as const satisfies Record<string, VireGlassOptics>;

export type LegacyOpticsName = keyof typeof LEGACY_OPTICS;
export const LEGACY_NAMES = Object.keys(LEGACY_OPTICS) as LegacyOpticsName[];

/** Пресеты материала: точки в пространстве ПРИЧИН, а не набор готовых следствий. */
export const MATERIAL_PRESETS = {
  Вода: VIREGLASS_MATERIAL_V4,
  Стекло: { ...VIREGLASS_MATERIAL_V4, ior: 1.45, thickness: 25, bevel: 12.6, roughness: 0.17 },
  Кристалл: { ...VIREGLASS_MATERIAL_V4, ior: 1.7, thickness: 30, bevel: 16, roughness: 0.02 },
  Матовое: { ...VIREGLASS_MATERIAL_V4, roughness: 0.55 },
  Толстое: { ...VIREGLASS_MATERIAL_V4, thickness: 48, bevel: 22 },
  Плёнка: { ...VIREGLASS_MATERIAL_V4, thickness: 4, bevel: 3 },
} as const satisfies Record<string, VireGlassMaterial>;

export type MaterialPresetName = keyof typeof MATERIAL_PRESETS;
export const PRESET_NAMES = Object.keys(MATERIAL_PRESETS) as MaterialPresetName[];

export const EFFECTS = [
  'backdrop',
  'blur',
  'refraction',
  'fresnel',
  'bevel',
  'specular',
  'dispersion',
  'tint',
  'environment',
  'adaptation',
] as const;

export type VireGlassEffect = (typeof EFFECTS)[number];
export type VireGlassToggles = Record<VireGlassEffect, boolean>;

export const ALL_EFFECTS_ON: VireGlassToggles = EFFECTS.reduce(
  (acc, e) => ({ ...acc, [e]: true }),
  {} as VireGlassToggles,
);

/**
 * Тумблер = обнуление СЛЕДСТВИЯ, а не ветка в шейдере: сравнение ON/OFF идёт на одном
 * варианте шейдера, иначе сравниваются две разные программы. Работает над оптикой, а не
 * над материалом: обнулить причину нельзя — она тянет за собой полдюжины следствий сразу.
 * `backdrop` тумблером здесь не закрывается: он решает, монтировать ли BlurView.
 */
export function applyToggles(
  optics: VireGlassOptics,
  toggles: Partial<VireGlassToggles> = {},
): VireGlassOptics {
  const on = { ...ALL_EFFECTS_ON, ...toggles };
  const o = { ...optics, tint: { ...optics.tint } };
  if (!on.blur) o.blur = 0;
  if (!on.refraction) {
    o.refraction = 0;
    o.refractionScale = 1;
    o.edgePushDp = 0;
  }
  if (!on.fresnel) o.fresnel = 0;
  if (!on.bevel) o.bevelDp = 1;
  if (!on.specular) o.specular = 0;
  if (!on.dispersion) o.dispersion = 0;
  if (!on.tint) o.tintStrength = 0;
  if (!on.environment) o.environment = 0;
  if (!on.adaptation) o.adaptation = 0;
  return o;
}

/** Порядок = значение `u_debug` в обоих шейдерах. Только для стенда. */
export const DEBUG_MODES = [
  'normal',
  'sdf',
  'mask',
  'edge',
  'fresnel',
  'refraction',
  'backdrop',
  'specular',
  'dispersion',
  'normals',
] as const;

export type VireGlassDebugMode = (typeof DEBUG_MODES)[number];

export function debugIndex(mode: VireGlassDebugMode): number {
  return DEBUG_MODES.indexOf(mode);
}

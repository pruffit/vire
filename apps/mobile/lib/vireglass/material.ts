// Модель материала VireGlass: ЧТО такое стекло, безотносительно того, как Android это
// рисует. Публичные имена — оптические понятия, не униформы шейдера. Перевод в униформы
// и пропы нативной вьюхи живёт в `adapters.ts`.

export type VireGlassTint = { r: number; g: number; b: number };

export type VireGlassMaterial = {
  /** Размытие бэкдропа, 0..100 (интенсивность expo-blur). */
  blur: number;
  /** Общая сила преломления, 0..1. 0 — бэкдроп проходит без смещения. */
  refraction: number;
  /** Увеличение в плоской середине: оптическая толщина среды. */
  refractionScale: number;
  /** Доля полуразмера под фаской — где живёт вся краевая оптика. */
  thickness: number;
  /** Сила краевого отклика по Френелю. */
  fresnel: number;
  /** Резкость нарастания Френеля к касательному углу. */
  fresnelPower: number;
  /** Блик. */
  specular: number;
  /** Узость блика. */
  specularPower: number;
  /** Хроматическое расхождение на кромке. */
  dispersion: number;
  /** Цвет стекла. */
  tint: VireGlassTint;
  /** Плотность тинта. */
  tintStrength: number;
  /** Яркость световой кромки. */
  edgeStrength: number;
  /** Ширина световой кромки в долях фаски. */
  edgeWidth: number;
  /** Общая непрозрачность материала. */
  opacity: number;
  /** Отклик на ориентацию устройства, 0 — свет закреплён к экрану. */
  environment: number;
};

export const MATERIAL_RANGES = {
  blur: [0, 100],
  refraction: [0, 1],
  refractionScale: [1, 1.6],
  thickness: [0.02, 0.5],
  fresnel: [0, 1],
  fresnelPower: [1, 8],
  specular: [0, 1],
  specularPower: [8, 160],
  dispersion: [0, 1],
  tintStrength: [0, 1],
  edgeStrength: [0, 1],
  edgeWidth: [0.05, 1],
  opacity: [0, 1],
  environment: [0, 1],
} as const satisfies Record<string, readonly [number, number]>;

export type VireGlassNumericKey = keyof typeof MATERIAL_RANGES;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * VireGlass Material v1 — дефолт продукта. Выбран по приоритетам §19 брифа Phase 3:
 * читаемость → оптическая правдоподобность → сдержанность → устойчивость → стоимость.
 * Не максимальная интенсивность: преломление умеренное, дисперсия почти на пороге
 * заметности, отклик на ориентацию выключен (стабильность важнее эффекта).
 */
export const VIREGLASS_MATERIAL_V1: VireGlassMaterial = {
  blur: 12,
  refraction: 0.55,
  refractionScale: 1.14,
  thickness: 0.18,
  fresnel: 0.5,
  fresnelPower: 3.2,
  specular: 0.42,
  specularPower: 58,
  dispersion: 0.22,
  tint: { r: 0.4, g: 0.4, b: 0.44 },
  tintStrength: 0.16,
  edgeStrength: 0.55,
  edgeWidth: 0.5,
  opacity: 1,
  environment: 0,
};

/** Пресеты стенда: карта пространства параметров, а не публичное API материала. */
export const MATERIAL_PRESETS = {
  'Material v1': VIREGLASS_MATERIAL_V1,
  'Clear Glass': {
    ...VIREGLASS_MATERIAL_V1,
    blur: 6,
    refraction: 0.3,
    refractionScale: 1.06,
    thickness: 0.12,
    fresnel: 0.35,
    specular: 0.3,
    specularPower: 70,
    dispersion: 0.08,
    tintStrength: 0.08,
    edgeStrength: 0.4,
    edgeWidth: 0.4,
  },
  'Soft Glass': {
    ...VIREGLASS_MATERIAL_V1,
    blur: 32,
    refraction: 0.35,
    refractionScale: 1.1,
    thickness: 0.24,
    fresnel: 0.4,
    fresnelPower: 2.4,
    specular: 0.28,
    specularPower: 30,
    dispersion: 0.1,
    tintStrength: 0.22,
    edgeStrength: 0.38,
    edgeWidth: 0.7,
  },
  'Optical Glass': {
    ...VIREGLASS_MATERIAL_V1,
    blur: 8,
    refraction: 0.85,
    refractionScale: 1.28,
    thickness: 0.2,
    fresnel: 0.7,
    fresnelPower: 4,
    specular: 0.6,
    specularPower: 88,
    dispersion: 0.45,
    tintStrength: 0.1,
    edgeStrength: 0.7,
    edgeWidth: 0.4,
  },
  'Liquid Glass': {
    ...VIREGLASS_MATERIAL_V1,
    blur: 16,
    refraction: 1,
    refractionScale: 1.36,
    thickness: 0.34,
    fresnel: 0.75,
    fresnelPower: 2.6,
    specular: 0.5,
    specularPower: 40,
    dispersion: 0.35,
    tintStrength: 0.14,
    edgeStrength: 0.6,
    edgeWidth: 0.65,
  },
  'Heavy Glass': {
    ...VIREGLASS_MATERIAL_V1,
    blur: 48,
    refraction: 0.6,
    refractionScale: 1.2,
    thickness: 0.42,
    fresnel: 0.6,
    specular: 0.35,
    specularPower: 44,
    dispersion: 0.2,
    tint: { r: 0.18, g: 0.18, b: 0.22 },
    tintStrength: 0.42,
    edgeStrength: 0.45,
    edgeWidth: 0.6,
  },
} as const satisfies Record<string, VireGlassMaterial>;

export type MaterialPresetName = keyof typeof MATERIAL_PRESETS;
export const PRESET_NAMES = Object.keys(MATERIAL_PRESETS) as MaterialPresetName[];

export function resolveMaterial(patch: Partial<VireGlassMaterial> = {}): VireGlassMaterial {
  const m = { ...VIREGLASS_MATERIAL_V1, ...patch };
  const out = { ...m, tint: { ...m.tint } };
  for (const key of Object.keys(MATERIAL_RANGES) as VireGlassNumericKey[]) {
    const [lo, hi] = MATERIAL_RANGES[key];
    out[key] = clamp(out[key], lo, hi);
  }
  out.tint = { r: clamp(m.tint.r, 0, 1), g: clamp(m.tint.g, 0, 1), b: clamp(m.tint.b, 0, 1) };
  return out;
}

export const EFFECTS = [
  'backdrop',
  'blur',
  'refraction',
  'fresnel',
  'thickness',
  'edge',
  'specular',
  'dispersion',
  'tint',
  'environment',
] as const;

export type VireGlassEffect = (typeof EFFECTS)[number];
export type VireGlassToggles = Record<VireGlassEffect, boolean>;

export const ALL_EFFECTS_ON: VireGlassToggles = EFFECTS.reduce(
  (acc, e) => ({ ...acc, [e]: true }),
  {} as VireGlassToggles,
);

/**
 * Тумблер = обнуление параметра, а не ветка в шейдере: сравнение ON/OFF идёт на ОДНОМ
 * варианте шейдера, иначе сравниваются две разные программы. `backdrop` тумблером здесь не
 * закрывается — он решает, монтировать ли BlurView, и живёт в компоненте.
 */
export function applyToggles(
  material: VireGlassMaterial,
  toggles: Partial<VireGlassToggles> = {},
): VireGlassMaterial {
  const on = { ...ALL_EFFECTS_ON, ...toggles };
  const m = { ...material, tint: { ...material.tint } };
  if (!on.blur) m.blur = 0;
  if (!on.refraction) {
    m.refraction = 0;
    m.refractionScale = 1;
  }
  if (!on.fresnel) m.fresnel = 0;
  if (!on.thickness) m.thickness = MATERIAL_RANGES.thickness[0];
  if (!on.edge) m.edgeStrength = 0;
  if (!on.specular) m.specular = 0;
  if (!on.dispersion) m.dispersion = 0;
  if (!on.tint) m.tintStrength = 0;
  if (!on.environment) m.environment = 0;
  return resolveMaterial(m);
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

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
  gatherRadius as gatherRadiusFrom,
  fresnelStrength,
  FRESNEL_EXPONENT,
  mediumTint,
  refractionScale as refractionScaleFrom,
  refractionStrength,
  specularPower as specularPowerFrom,
  bodyDensity as bodyDensityFrom,
  edgeLight as edgeLightFrom,
  iridescence as iridescenceFrom,
  diffraction as diffractionFrom,
  colorPickup as colorPickupFrom,
  specularStrength,
  iorSpread as iorSpreadFrom,
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
  /** Не физика, а требование читаемости: насколько сильно стекло обязано развести свою
   *  светлоту с надписью поверх себя. 0 — стекло просто прозрачное. */
  legibility: number;
  /** Затемняющий слой ПОД стеклом, 0..1. Прозрачному варианту (Clear) читаемость даёт именно
   *  он: адаптации у такого стекла нет, и без затемнения краска тонет на ярком контенте.
   *
   *  Не путать с пропом `dim` мобильной поверхности: тот компенсирует платформенный захват
   *  (BlurView не видит скрим экрана над контентом), а это — свойство самого материала. */
  dimming: number;
  /** Светлота того, что приложение рисует ПОВЕРХ стекла: 1 — светлые иконки и текст,
   *  0 — тёмные. Причина, а не ручка: её знает вызывающий экран. */
  ink: number;
  /** Минимальная РАЗЛИЧИМОСТЬ самой детали: на сколько её тело обязано отойти по светлоте
   *  от фона под ней. Не то же, что `legibility` — та про надпись ПОВЕРХ стекла, эта про сам
   *  элемент. Над однородным фоном стеклу нечего преломлять, и деталь пропадает; для
   *  управляющего элемента это недопустимо. 0 — различимость не требуется.
   *
   *  Знак берётся ОТ ФОНА, а не от полярности надписи: над тёмным тело светлеет, над
   *  светлым темнеет. Поэтому требование работает одинаково на любом фоне. */
  presence: number;
  /** Толщина поверхностной плёнки, нм. Отсюда интерференция: разность хода в плёнке
   *  сравнима с длиной волны, и отражение окрашивается переливами. 0 — плёнки нет. */
  film: number;
};

export const MATERIAL_RANGES = {
  ior: [1, 2],
  thickness: [0, 60],
  bevel: [0, 40],
  roughness: [0, 1],
  environment: [0, 1],
  legibility: [0, 1],
  dimming: [0, 0.5],
  ink: [0, 1],
  presence: [0, 0.6],
  film: [0, 900],
} as const satisfies Record<string, readonly [number, number]>;

export type VireGlassNumericKey = keyof typeof MATERIAL_RANGES;

/** Радиус, по которому берётся ЛОКАЛЬНАЯ светлота фона, dp. Не по пикселю: иначе стекло
 *  гоняется за штрихами и вокруг букв под ним появляется ореол. */
export const ADAPT_RADIUS = 22;

/** Затемнение линзы у продуктовых поверхностей — плоская заливка поверх бэкдропа. */
export const PRODUCT_DIM = 0.2;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Величины, которые нужны шейдерам. Собираются из материала, руками не задаются. */
export type VireGlassOptics = {
  blur: number;
  refraction: number;
  refractionScale: number;
  /** Ширина фаски в dp — абсолютная величина среды. */
  bevelDp: number;
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
  legibility: number;
  /** Затемнение контента под стеклом — тот самый слой варианта Clear. */
  dimming: number;
  ink: number;
  /** Минимальная различимость детали на фоне — в единицах светлоты. */
  presence: number;
  adaptRadius: number;
  bodyDensity: number;
  edgeLight: number;
  /** Толщина плёнки, нм — прямо в шейдер: разность хода считается в тех же единицах. */
  film: number;
  /** Сила переливов на отражении. */
  iridescence: number;
  /** Сила краевых дифракционных полос. */
  diffraction: number;
  /** Насколько тело красится цветом окружения. */
  colorPickup: number;
  /** Показатель преломления: сдвиг луча шейдер считает по закону Снелла. */
  ior: number;
  /** Толщина пластины, dp — до поправки на размер детали. */
  thicknessDp: number;
  /** Разнос показателя между красным и синим каналом — дисперсия. */
  iorSpread: number;
};

// Продовый дефолт — «вода»: ниже показатель преломления, тоньше среда и фаска, почти
// гладкая поверхность. Выбрано на устройстве в стенде.
export const VIREGLASS_MATERIAL_V4: VireGlassMaterial = {
  ior: 1.33,
  thickness: 14,
  bevel: 5,
  roughness: 0.05,
  environment: 0.27,
  legibility: 0.26,
  dimming: 0,
  ink: 1,
  presence: 0.05,
  film: 340,
};


/**
 * Стекло, а не вода. У v4 показатель преломления 1.33 — это вода: почти нет отражения на
 * кромке, почти нет дисперсии, увеличение 2 %. На экране такая поверхность честно выглядит
 * «никак», и её принимали за выключенное стекло.
 *
 * 1.5 — обычное стекло. Следствия считаются из него сами: отражение на кромке вдвое сильнее,
 * дисперсия в полтора раза, подхват цвета окружения на потолке. Толщина поднята чуть-чуть:
 * она задаёт увеличение, но вместе с ним и поглощение, а поглощение — это чернота.
 */
export const VIREGLASS_MATERIAL_V5: VireGlassMaterial = {
  ior: 1.5,
  thickness: 28,
  bevel: 6,
  roughness: 0.06,
  environment: 0.27,
  legibility: 0.26,
  dimming: 0,
  ink: 1,
  presence: 0.05,
  film: 340,
};

/**
 * Матовое стекло листа. Лист лежит поверх ЖИВОГО экрана, и прозрачным ему быть нельзя:
 * сквозь него читались кнопки транспорта и прогресс — вёрстка выглядела сломанной.
 * Затемнением это не лечится (плоский скрим поверх резкой картинки её не прячет), поэтому
 * поднята шероховатость: она даёт `u_frost` — нижний порог размытия бэкдропа, на который
 * потолок адаптивного размытия не распространяется.
 *
 * `legibility` здесь наследуется и сама по себе ничего не значит: потребитель обязан пройти
 * через `materialForInk`, которая знает два исхода — 0.95 и 0.
 */
export const VIREGLASS_SHEET_MATERIAL: VireGlassMaterial = {
  ...VIREGLASS_MATERIAL_V5,
  roughness: 0.85,
};
/** Материал продукта. Потребители берут его, а не версию поимённо. */
/**
 * Стекло под крупным текстом (панель текста в плеере).
 *
 * Продуктовый материал БЕЗ изменений оптики — поднята только `legibility`. Это и есть её
 * причина: «на мне обязаны читаться надписи». Она добавляет плотность по месту — плотнее
 * над светлым и пёстрым, прозрачнее над ровным тёмным.
 *
 * Собственный толстый материал (thickness 52, ior 1.58) отсюда уже убирали: поглощение
 * среды растёт с толщиной, и панель покрывалась чёрным кантом по периметру — вместо стекла
 * получалась закопчённая пластина. Толщину под читаемость не крутить, для этого есть
 * `legibility`.
 */
export const VIREGLASS_LYRICS_MATERIAL: VireGlassMaterial = {
  ...VIREGLASS_MATERIAL_V5,
  legibility: 0.95,
};

/**
 * Стекло органов управления — кнопок, плашек, всего, что нажимают.
 *
 * ТОЛСТОЕ И ЧИСТОЕ, а не базовое: шире фаска, в полтора раза больше толщина, выше показатель
 * преломления и почти нет шероховатости. Базовое стекло — линза над спокойным фоном; орган
 * управления обязан читаться предметом, который можно взять, и это делает не заливка, а объём:
 * широкая фаска даёт кромке за что зацепиться, а толщина — глубину.
 *
 * Толщину задаёт НАКОПЛЕНИЕ У КРОМКИ: у эталонной ручки изображение полосы под деталью
 * раздувается там в 1.85 раза, у нас при 30 выходило 1.36. Насыщение наступает около 44, и
 * лишняя толщина берёт только поглощение — поэтому 44, а не больше.
 *
 * Она же тянет за собой `tintStrength` (= `absorption(thickness)`), а он на пути БЕЗ нативной
 * линзы задаёт плотность тела: там деталь плотнее на 2.4 процентных пункта. На вебе тела в
 * поверхности нет вовсе, эффект только на Android до 13.
 *
 * `presence` поднят по той же причине: кусок фона имеет право исчезнуть над однородным
 * полотном, элемент управления — нет, его надо видеть до того, как в него ткнули.
 *
 * ВАЖНО про размер. Фаска задана средой в dp и от габарита не зависит, но геометрия зажимает
 * её половиной меньшего полуразмера (`MAX_BEVEL_FRACTION`). На кнопке 52 dp это 13 вместо 16 —
 * мелкая деталь из такого стекла оказывается фаской целиком. Так и задумано: маленький кусок
 * толстого стекла и должен выглядеть линзой, а не пластинкой.
 */
export const VIREGLASS_CONTROL_MATERIAL: VireGlassMaterial = {
  ...VIREGLASS_MATERIAL_V5,
  ior: 1.69,
  thickness: 44,
  bevel: 8,
  roughness: 0.035,
  presence: 0.176,
};

export const VIREGLASS_MATERIAL = VIREGLASS_MATERIAL_V5;

/**
 * Деталь, НЕСУЩАЯ КРАСКУ приложения (значок, строку, обложку), обязана держать её читаемой —
 * это и есть причина `legibility`. Деталь без краски разводить светлоту не с чем, и требование
 * у неё выключено: модель обещает ей просто прозрачное стекло.
 *
 * Правило живёт здесь, а не у потребителя: иначе одна и та же кнопка со значком получает на
 * вебе и на Android разную читаемость.
 */
export function materialForInk(material: VireGlassMaterial, carriesInk: boolean): VireGlassMaterial {
  // У прозрачного варианта читаемость держит затемняющий слой, а не тело. Поднять ему
  // требование значит сделать из него обычное стекло, а варианты не смешивают (219 §Clear).
  if (material.dimming > 0) return material;
  return { ...material, legibility: carriesInk ? VIREGLASS_LYRICS_MATERIAL.legibility : 0 };
}

/**
 * Прозрачный вариант материала (Clear). Адаптации у него нет — стекло постоянно прозрачнее,
 * контент под ним виден почти как есть, а читаемость краски держит затемняющий слой. Годится
 * только там, где выполнены три условия эталона: деталь лежит на медиа, контент терпит
 * затемнение, а краска поверх крупная и яркая.
 */
export const VIREGLASS_CLEAR_MATERIAL: VireGlassMaterial = {
  ...VIREGLASS_MATERIAL,
  legibility: 0,
  presence: 0,
  dimming: 0.22,
};

/**
 * АКТИВНОЕ СОСТОЯНИЕ как состояние СРЕДЫ, а не как подсветка поверх неё.
 *
 * Активная деталь — это более плотное и более чистое стекло: выше показатель преломления,
 * толще тело, шире фаска, меньше шероховатости. Из этих причин сами собой следуют и яркая
 * кромка, и сильный блик, и большее присутствие — собирать их по отдельности значит получить
 * состояние, которого у стекла не бывает.
 *
 * `environment` здесь НЕ трогается намеренно. Оно задаёт, насколько тело красится тем, что под
 * ним, и на максимуме активная кнопка над обложкой превращалась в цветное пятно: состояние
 * читалось как «испачкана», а не как «выбрана». Признак состояния обязан не зависеть от фона —
 * иначе любая проехавшая под деталью картинка его подделает.
 */
export function activeMaterial(material: VireGlassMaterial, on: number): VireGlassMaterial {
  const k = Math.min(Math.max(on, 0), 1);
  return {
    ...material,
    ior: material.ior + 0.35 * k,
    thickness: material.thickness * (1 + 0.9 * k),
    bevel: material.bevel * (1 + 1.8 * k),
    roughness: material.roughness * (1 - 0.75 * k),
    presence: material.presence + 0.12 * k,
  };
}

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
    legibility: m.legibility,
    dimming: m.dimming,
    ink: m.ink,
    presence: m.presence,
    adaptRadius: ADAPT_RADIUS,
    bodyDensity: bodyDensityFrom(m.thickness),
    edgeLight: edgeLightFrom(m.ior),
    film: m.film,
    iridescence: iridescenceFrom(m.ior, m.film),
    diffraction: diffractionFrom(m.ior),
    colorPickup: colorPickupFrom(m.ior),
    ior: m.ior,
    thicknessDp: m.thickness,
    iorSpread: iorSpreadFrom(m.ior),
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
    legibility: 0.55,
    dimming: 0,
    ink: 1,
    presence: 0,
    adaptRadius: ADAPT_RADIUS,
    bodyDensity: 0.14,
    edgeLight: 0.35,
    film: 0,
    iridescence: 0,
    diffraction: 0,
    colorPickup: 0,
    ior: 1.5,
    thicknessDp: 16,
    iorSpread: 0,
  },
  'v2': {
    blur: 5,
    refraction: 0.95,
    refractionScale: 1.34,
    bevelDp: 14,
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
    legibility: 0,
    dimming: 0,
    ink: 1,
    presence: 0,
    adaptRadius: ADAPT_RADIUS,
    bodyDensity: 0.14,
    edgeLight: 0.35,
    film: 0,
    iridescence: 0,
    diffraction: 0,
    colorPickup: 0,
    ior: 1.5,
    thicknessDp: 16,
    iorSpread: 0,
  },
  'v1': {
    blur: 12,
    refraction: 0.55,
    refractionScale: 1.14,
    bevelDp: 10,
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
    legibility: 0,
    dimming: 0,
    ink: 1,
    presence: 0,
    adaptRadius: ADAPT_RADIUS,
    bodyDensity: 0.14,
    edgeLight: 0.35,
    film: 0,
    iridescence: 0,
    diffraction: 0,
    colorPickup: 0,
    ior: 1.5,
    thicknessDp: 16,
    iorSpread: 0,
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
  Бензин: { ...VIREGLASS_MATERIAL_V4, ior: 1.5, thickness: 8, bevel: 6, film: 620 },
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
  'legibility',
  'interference',
  'diffraction',
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
    o.ior = 1;
  }
  if (!on.fresnel) o.fresnel = 0;
  if (!on.bevel) o.bevelDp = 1;
  if (!on.specular) o.specular = 0;
  if (!on.dispersion) {
    o.dispersion = 0;
    o.iorSpread = 0;
  }
  if (!on.tint) o.tintStrength = 0;
  if (!on.environment) o.environment = 0;
  if (!on.legibility) {
    o.legibility = 0;
    // Затемняющий слой — тот же ответ на требование читаемости, только у прозрачного варианта.
    o.dimming = 0;
  }
  if (!on.interference) o.iridescence = 0;
  if (!on.diffraction) o.diffraction = 0;
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
  'spectral',
  'adapt',
] as const;

export type VireGlassDebugMode = (typeof DEBUG_MODES)[number];

export function debugIndex(mode: VireGlassDebugMode): number {
  return DEBUG_MODES.indexOf(mode);
}

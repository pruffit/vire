// Вывод оптики из свойств среды. Материал описывает ПРИЧИНЫ (показатель преломления,
// толщина, фаска, шероховатость), шейдерам нужны СЛЕДСТВИЯ — этот файл переводит одно в
// другое. Чистые функции, без импортов: физика проверяется тестами, а не на устройстве.
//
// Нормировочные константы здесь есть и они честно помечены: рендер стилизованный, и
// буквальные физические величины (у стекла отражение при нормальном падении 4%) дают
// эффекты на пороге заметности. Каждая нормировка монотонна по своей причине, поэтому
// «плотнее среда → заметнее кромка» сохраняется, а невозможных сочетаний не возникает.

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

/** Отражение при нормальном падении: ((n−1)/(n+1))². Для стекла n=1.5 это 0.04. */
export const fresnelF0 = (ior: number) => ((ior - 1) / (ior + 1)) ** 2;

/** Перевод физических 4% в рабочий диапазон рендера. */
const FRESNEL_GAIN = 17.5;

export const fresnelStrength = (ior: number) => clamp01(fresnelF0(ior) * FRESNEL_GAIN);

/** Показатель в приближении Шлика — константа модели, а не ручка. */
export const FRESNEL_EXPONENT = 5;

/** Сила изгиба луча. При n→1 среда неотличима от воздуха; n=1.6 принят за полную силу. */
export const refractionStrength = (ior: number) => clamp01((ior - 1) / 0.6);

/** Увеличение за плоскопараллельной пластиной: растёт с толщиной и с (1 − 1/n). */
const MAGNIFY_PER_DP = 0.006;

export const refractionScale = (ior: number, thicknessDp: number) =>
  1 + MAGNIFY_PER_DP * thicknessDp * (1 - 1 / Math.max(ior, 1));

/** У обычных стёкол число Аббе падает вместе с ростом n — дисперсия растёт следом. */
const DISPERSION_PER_IOR = 1.1;

export const dispersion = (ior: number) => clamp01((ior - 1) * DISPERSION_PER_IOR);

/** Бугер–Ламберт: сколько поглотит среда на пути длиной `pathDp`. */
const ABSORB_PER_DP = 0.017;

export const absorption = (pathDp: number) => 1 - Math.exp(-ABSORB_PER_DP * Math.max(pathDp, 0));

/**
 * Плотность у фаски относительно тела. Никакой отдельной величины: у кромки луч идёт
 * через среду ДЛИННЕЕ на ширину фаски, и поглощение на этом пути больше. Раньше это был
 * ползунок `edgeDensity`, из-за которого собиралась тонкая фаска с молочной кромкой —
 * состояние, которого в стекле не бывает.
 */
export const edgeDensity = (thicknessDp: number, bevelDp: number) => {
  const body = absorption(thicknessDp);
  if (body <= 0) return 1;
  return clamp(absorption(thicknessDp + bevelDp) / body, 1, 4);
};

/** Мутность бэкдропа — шероховатость поверхности, а не отдельная настройка размытия. */
const BLUR_MAX = 26;

export const blur = (roughness: number) => clamp01(roughness) * BLUR_MAX;

/** Гладкая поверхность даёт узкий блик, шероховатая — размытый. */
export const specularPower = (roughness: number) => 160 - clamp01(roughness) * 152;

/** Яркость блика — то же отражение, что и Френель, приглушённое шероховатостью. */
export const specularStrength = (ior: number, roughness: number) =>
  clamp01(fresnelStrength(ior) * (1 - clamp01(roughness) * 0.6));

/**
 * Смещение выборки у самой кромки. Зависит от среды и ширины фаски — не от габарита
 * детали: у настоящего стекла луч не знает, какого размера кусок отрезали. Отсюда мелкая
 * поверхность преломляет заметнее крупной без всякой «компенсации размера».
 */
const EDGE_PUSH_PER_BEVEL = 2.6;

export const edgePush = (ior: number, bevelDp: number) =>
  refractionStrength(ior) * EDGE_PUSH_PER_BEVEL * Math.max(bevelDp, 0);

/**
 * Цвет среды. Руками не задаётся: у прозрачных сред оттенок связан с плотностью. Вода
 * поглощает красный и уходит в холодный, обычное стекло почти нейтрально с лёгкой зеленью,
 * плотные высокоиндексные — в тёплый. Светлота следует за отражением: чем плотнее среда,
 * тем больше окружения она возвращает и тем светлее читается её тело.
 */
const COOL = { r: 0.86, g: 1.0, b: 1.08 };
const NEUTRAL = { r: 1.0, g: 1.02, b: 0.99 };
const WARM = { r: 1.08, g: 1.0, b: 0.88 };

const mixHue = (a: typeof COOL, b: typeof COOL, t: number) => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

export function mediumTint(ior: number): { r: number; g: number; b: number } {
  const t = clamp01((ior - 1.2) / 0.55);
  const hue = t < 0.5 ? mixHue(COOL, NEUTRAL, t * 2) : mixHue(NEUTRAL, WARM, (t - 0.5) * 2);
  const lift = 0.34 + fresnelF0(ior) * 2.4;
  return { r: clamp01(hue.r * lift), g: clamp01(hue.g * lift), b: clamp01(hue.b * lift) };
}

/**
 * Докуда кромка собирает свет ВОКРУГ детали.
 *
 * У настоящего стекла на скользящем угле в глаз приходит не то, что под стеклом, а
 * окружение: предмет на чёрном столе рядом с лампой ловит лампу. Поэтому радиус заметно
 * больше фаски — это окрестность детали, а не её кромка. Без этого стекло на пустом
 * чёрном фоне не имеет источника вовсе и честно исчезает.
 */
const GATHER_PER_BEVEL = 4;

export const gatherRadius = (bevelDp: number) => Math.max(bevelDp, 1) * GATHER_PER_BEVEL;

/**
 * Плотность тела в плоской середине. Раньше жила константой в поверхностном шейдере; теперь
 * тело считает линза, и величина переезжает сюда вместе с остальными следствиями.
 */
const BODY_DENSITY = 0.19;

export const bodyDensity = (thicknessDp: number) => BODY_DENSITY * absorption(thicknessDp);

/**
 * Насколько кромка подхватывает свет и цвет окрестности. Это то же отражение, что и Френель:
 * отдельной ручки не заводим — плотная среда возвращает больше окружения по построению.
 */
export const edgeLight = (ior: number) => fresnelStrength(ior);

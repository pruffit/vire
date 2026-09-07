import { colors } from '../theme';

export type Rgb = { r: number; g: number; b: number };

/** `#rgb` и `#rrggbb`; всё остальное — null, вызывающий берёт запасной цвет. */
export function parseHex(hex: string | null | undefined): Rgb | null {
  if (!hex) return null;
  const raw = hex.trim().replace('#', '');
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}

const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Относительная яркость по WCAG. */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hex2 = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
const toHex = ({ r, g, b }: Rgb) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
const c255 = (v: number) => Math.round(clamp01(v) * 255);
const toRgba = ({ r, g, b }: Rgb, a: number) => `rgba(${c255(r)}, ${c255(g)}, ${c255(b)}, ${a})`;

type Hsl = { h: number; s: number; l: number };

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

const hueChannel = (p: number, q: number, t: number) => {
  const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
};

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) return { r: l, g: l, b: l };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: hueChannel(p, q, h + 1 / 3), g: hueChannel(p, q, h), b: hueChannel(p, q, h - 1 / 3) };
};

/**
 * Насыщенный синий или фиолетовый — нормальный акцент, и белый глиф на нём читается. Порог
 * нужен только против почти чёрного: фон экрана берётся из того же цвета, и такая кнопка
 * растворилась бы в нём.
 */
const MIN_FILL_LUMA = 0.05;
/** Выше этой яркости на заливке читается тёмное, ниже — светлое. */
const INK_FLIP_LUMA = 0.4;

/**
 * Подложка карточки: тот же тон, но темнее, иначе карточка не отделяется. Затемнение
 * СМЕШИВАНИЕМ С ЧЁРНЫМ обесцвечивает — у канала падает и светлота, и насыщенность, и от
 * бирюзы остаётся серо-зелёная грязь. Поэтому тон сохраняется, меняется только светлота.
 */
const WASH_L = 0.19;
const WASH_S = 0.34;

/** Хью тёплой нейтрали продукта (`docs/PRODUCT.md`, «hue ~75»), а не чистый серый —
 *  на ней стоит сцена трека без акцента. */
const NEUTRAL_HUE = 75 / 360;

/** Цвет по тону в градусах: дымка фона задана в HSL и строится прямо из него. */
export function hueHex(degrees: number, s: number, l: number): string {
  const h = (((degrees % 360) + 360) % 360) / 360;
  return toHex(hslToRgb({ h, s, l }));
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  return rgb ? toRgba(rgb, alpha) : `rgba(0, 0, 0, ${alpha})`;
}

/**
 * Из обложки берётся ТОН, а светлоты сцены задаёт сама сцена (`components/haze-ground.tsx`,
 * порт `drawAppBackground`). Готовых ролей поля здесь больше нет: они были вдвое темнее
 * вебовых, и экран под органами управления уходил в бесцветное почти-чёрное.
 */
export type Accent = {
  /** Тон трека в градусах: по нему строятся пятна дымки фона. */
  hue: number;
  /** Заливка главной кнопки и прогресса. */
  fill: string;
  /** Что читается НА заливке. */
  ink: string;
  /** Подложка карточки в тон трека. */
  wash: string;
};

const NEUTRAL: Accent = {
  hue: NEUTRAL_HUE * 360,
  fill: colors.foreground,
  ink: colors.background,
  wash: colors.secondary,
};

/**
 * Акцент темы артиста, приведённый к ролям.
 *
 * Цвет берётся сильно приглушённым: в полную силу он забивает обложку, ради которой экран
 * и открывают. Референсы делают то же — приглушённый тон от артворка, а не сам артворк.
 */
export function resolveAccent(hex: string | null | undefined): Accent {
  const rgb = parseHex(hex);
  if (!rgb) return NEUTRAL;

  const luma = luminance(rgb);
  const fillable = luma >= MIN_FILL_LUMA;
  const { h } = rgbToHsl(rgb);

  return {
    hue: h * 360,
    fill: fillable ? toHex(rgb) : colors.foreground,
    ink: !fillable || luma > INK_FLIP_LUMA ? colors.background : colors.foreground,
    wash: toHex(hslToRgb({ h, s: WASH_S, l: WASH_L })),
  };
}

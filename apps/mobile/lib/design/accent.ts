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
 * Светлота ступеней фона. Затемнение СМЕШИВАНИЕМ С ЧЁРНЫМ обесцвечивает: у канала падает
 * и светлота, и насыщенность, и от бирюзы остаётся серо-зелёная грязь. Поэтому тон и
 * насыщенность сохраняются, меняется только светлота.
 */
const GROUND_L = [0.17, 0.1] as const;
/** Ниже этого фон не читается цветным вовсе — поднимаем блёклый акцент до внятного. */
const GROUND_MIN_S = 0.42;
/** Подложка карточки: тот же тон, но темнее ступеней фона, иначе карточка не отделяется. */
const WASH_L = 0.14;
const WASH_S = 0.3;

export type Accent = {
  /** Заливка главной кнопки и прогресса. */
  fill: string;
  /** Что читается НА заливке. */
  ink: string;
  /** Верхний тон фона экрана. */
  ground: string;
  /** Ступени градиента фона, сверху вниз; последняя — палитра приложения. */
  gradient: readonly [string, string, string];
  /** Те же ступени с альфа-рампой: ими размытая обложка гасится книзу, не темнея. */
  veil: readonly [string, string, string];
  /** Подложка карточки в тон трека. */
  wash: string;
};

const NEUTRAL: Accent = {
  fill: colors.foreground,
  ink: colors.background,
  ground: colors.background,
  gradient: ['#14110e', '#0a0806', colors.background],
  veil: ['rgba(20, 17, 14, 0)', 'rgba(10, 8, 6, 0.9)', 'rgba(3, 2, 1, 1)'],
  wash: colors.secondary,
};

/**
 * Акцент темы артиста, приведённый к ролям.
 *
 * Фон берётся сильно затемнённым: в полную силу цвет забивает обложку, ради которой экран
 * и открывают. Референсы делают то же — приглушённый тон от артворка, а не сам артворк.
 */
export function resolveAccent(hex: string | null | undefined): Accent {
  const rgb = parseHex(hex);
  if (!rgb) return NEUTRAL;

  const luma = luminance(rgb);
  const fillable = luma >= MIN_FILL_LUMA;
  const { h, s } = rgbToHsl(rgb);
  const groundS = Math.max(s, GROUND_MIN_S);
  const step = (l: number, sat: number) => toHex(hslToRgb({ h, s: sat, l }));
  const veilStep = (l: number, a: number) => toRgba(hslToRgb({ h, s: groundS, l }), a);

  return {
    fill: fillable ? toHex(rgb) : colors.foreground,
    ink: !fillable || luma > INK_FLIP_LUMA ? colors.background : colors.foreground,
    ground: step(GROUND_L[0], groundS),
    gradient: [step(GROUND_L[0], groundS), step(GROUND_L[1], groundS), colors.background],
    veil: [veilStep(GROUND_L[0], 0), veilStep(GROUND_L[1], 0.9), 'rgba(3, 2, 1, 1)'],
    wash: step(WASH_L, WASH_S),
  };
}

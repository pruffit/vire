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

const hex2 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
const toHex = ({ r, g, b }: Rgb) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
const mixToBlack = ({ r, g, b }: Rgb, keep: number) => ({ r: r * keep, g: g * keep, b: b * keep });

/**
 * Насыщенный синий или фиолетовый — нормальный акцент, и белый глиф на нём читается. Порог
 * нужен только против почти чёрного: фон экрана берётся из того же цвета, и такая кнопка
 * растворилась бы в нём.
 */
const MIN_FILL_LUMA = 0.05;
/** Выше этой яркости на заливке читается тёмное, ниже — светлое. */
const INK_FLIP_LUMA = 0.4;
/** Сколько цвета остаётся в фоне экрана. */
const GROUND_KEEP = 0.22;

export type Accent = {
  /** Заливка главной кнопки и прогресса. */
  fill: string;
  /** Что читается НА заливке. */
  ink: string;
  /** Верхний тон фона экрана. */
  ground: string;
};

/**
 * Акцент темы артиста, приведённый к трём ролям.
 *
 * Фон берётся сильно затемнённым: в полную силу цвет забивает обложку, ради которой экран
 * и открывают. Референсы делают то же — приглушённый тон от артворка, а не сам артворк.
 */
export function resolveAccent(hex: string | null | undefined): Accent {
  const rgb = parseHex(hex);
  if (!rgb) return { fill: colors.foreground, ink: colors.background, ground: colors.background };

  const luma = luminance(rgb);
  const fillable = luma >= MIN_FILL_LUMA;
  return {
    fill: fillable ? toHex(rgb) : colors.foreground,
    ink: !fillable || luma > INK_FLIP_LUMA ? colors.background : colors.foreground,
    ground: toHex(mixToBlack(rgb, GROUND_KEEP)),
  };
}

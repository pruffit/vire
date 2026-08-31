import { createContext, useContext, type ReactNode } from 'react';
import { INK_DARK, INK_LIGHT } from './adaptation';

/**
 * Полярность надписей ПОВЕРХ стекла, розданная детям поверхности.
 *
 * Стекло само решает, светлыми или тёмными обязаны быть буквы на нём: оно единственное
 * видит, что под ним лежит (`useGlassAdaptation`). Детям остаётся спросить цвет — иначе
 * каждый экран заводил бы свою логику и они разъезжались бы между собой.
 *
 * Значение непрерывно: на перекраске оно едет между концами, и цвет едет вместе с ним.
 */
const GlassInkContext = createContext(1);

export function GlassInkProvider({ ink, children }: { ink: number; children: ReactNode }) {
  return <GlassInkContext.Provider value={ink}>{children}</GlassInkContext.Provider>;
}

/** Полярность: 1 — надписи светлые, 0 — тёмные. */
export function useGlassInk(): number {
  return useContext(GlassInkContext);
}

const hex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);

/**
 * Цвет надписи для текущей полярности. Между концами идёт по светлоте — той же, по которой
 * стекло считает своё разделение, поэтому текст и тело не расходятся на переходе.
 */
export function inkColor(ink: number, light: string, dark: string): string {
  if (ink >= 0.999) return light;
  if (ink <= 0.001) return dark;
  // Промежуточные кадры живут доли секунды, и точная интерполяция по каналам здесь не нужна:
  // важно, чтобы переход не читался ступенькой.
  const v = INK_DARK + (INK_LIGHT - INK_DARK) * ink;
  const g = hex(v);
  return `rgb(${g}, ${g}, ${g})`;
}

export function useInkColor(light: string, dark: string): string {
  return inkColor(useGlassInk(), light, dark);
}

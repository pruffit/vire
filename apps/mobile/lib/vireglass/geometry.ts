import type { VireGlassMaterial } from './material';

/** Форма стекла в dp. Круг и капсула — частные случаи скруглённого прямоугольника. */
export type VireGlassGeometry = {
  width: number;
  height: number;
  cornerRadius: number;
};

export const circleGeometry = (size: number): VireGlassGeometry => ({
  width: size,
  height: size,
  cornerRadius: size / 2,
});

export const capsuleGeometry = (width: number, height: number): VireGlassGeometry => ({
  width,
  height,
  cornerRadius: Math.min(width, height) / 2,
});

export const roundedRectGeometry = (
  width: number,
  height: number,
  cornerRadius: number,
): VireGlassGeometry => ({ width, height, cornerRadius });

export const halfMinDp = (g: VireGlassGeometry) => Math.max(Math.min(g.width, g.height) / 2, 1);

/** Ширина фаски в dp: доля полуразмера, а не абсолютная величина — иначе крупная панель
 *  получает ту же кромку, что кнопка 58 dp, и читается тонкой плёнкой. */
export const bevelDp = (g: VireGlassGeometry, m: VireGlassMaterial) =>
  Math.max(m.thickness * halfMinDp(g), 1);

/** Докуда у самой кромки уходит выборка бэкдропа. `refraction = 1` даёт треть полуразмера. */
export const EDGE_REACH = 0.34;
const SPHERICAL_PER_BEVEL = 0.26;
const CHROMA_PER_BEVEL = 0.3;
const SHADOW_REACH_MAX = 26;

export const edgePushDp = (g: VireGlassGeometry, m: VireGlassMaterial) =>
  m.refraction * EDGE_REACH * halfMinDp(g);

export const sphericalDp = (g: VireGlassGeometry, m: VireGlassMaterial) =>
  m.refraction * SPHERICAL_PER_BEVEL * bevelDp(g, m);

export const chromaDp = (g: VireGlassGeometry, m: VireGlassMaterial) =>
  m.dispersion * CHROMA_PER_BEVEL * bevelDp(g, m);

export const shadowReachDp = (g: VireGlassGeometry) =>
  Math.min(halfMinDp(g) * 0.62, SHADOW_REACH_MAX);

/** Насколько вторая форма морфинга вылезает за габарит первой. Без этого запаса слитая
 *  форма обрезается краем канваса и эксперимент показывает не то, что проверяет. */
export function morphReachDp(
  g: VireGlassGeometry,
  morph?: { offsetX: number; offsetY: number; width: number; height: number; smoothing: number },
): number {
  if (!morph || morph.smoothing <= 0) return 0;
  return Math.max(
    0,
    Math.abs(morph.offsetX) + morph.width / 2 - g.width / 2,
    Math.abs(morph.offsetY) + morph.height / 2 - g.height / 2,
  );
}

/** Запас вьюхи линзы с каждой стороны: за его пределами шейдеру нечего семплировать. */
export function lensPadDp(
  g: VireGlassGeometry,
  m: VireGlassMaterial,
  morph?: Parameters<typeof morphReachDp>[1],
): number {
  return Math.ceil(edgePushDp(g, m) + sphericalDp(g, m) + chromaDp(g, m) + morphReachDp(g, morph) + 2);
}

/** Запас канваса поверхности: тень уходит наружу формы, а перетаскивание сдвигает её ещё. */
export function surfacePadDp(
  g: VireGlassGeometry,
  dragLimit = 0,
  morph?: Parameters<typeof morphReachDp>[1],
): number {
  return Math.ceil(shadowReachDp(g) * 1.2 + dragLimit + morphReachDp(g, morph) + 2);
}

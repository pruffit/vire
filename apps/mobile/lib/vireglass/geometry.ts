import type { VireGlassOptics } from './material';

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

/** Максимальное растяжение вдоль вектора тяги. Один и тот же закон применяют шейдер
 *  (обратной деформацией координаты) и трансформ живой подложки — иначе они разъезжаются.
 *  Живёт здесь, а не в компоненте: от него зависит запас вьюхи линзы. */
export const MAX_STRETCH = 0.17;

/**
 * Краевые длины приходят из материала уже в dp и от габарита детали НЕ зависят: у стекла
 * фаска и смещение луча заданы средой, а не тем, какого размера кусок отрезали. Отсюда
 * мелкая поверхность преломляет заметнее крупной сама собой — прежняя «компенсация
 * размера» с потолком и опорным полуразмером была подпоркой под модель, где всё мерялось
 * долями габарита.
 *
 * Геометрия здесь только ОГРАНИЧИВАЕТ: фаска шире полуразмера ломает SDF, а смещение
 * больше полуразмера уводит выборку за пределы формы целиком.
 */
export const MAX_BEVEL_FRACTION = 0.5;
const MAX_PUSH_FRACTION = 0.85;

export const bevelFraction = (g: VireGlassGeometry, o: VireGlassOptics) =>
  Math.min(MAX_BEVEL_FRACTION, o.bevelDp / halfMinDp(g));

export const bevelDp = (g: VireGlassGeometry, o: VireGlassOptics) =>
  Math.max(bevelFraction(g, o) * halfMinDp(g), 1);

export const edgePushDp = (g: VireGlassGeometry, o: VireGlassOptics) =>
  Math.min(o.edgePushDp, MAX_PUSH_FRACTION * halfMinDp(g));

const SPHERICAL_PER_BEVEL = 0.26;
const CHROMA_PER_BEVEL = 0.3;
const SHADOW_REACH_MAX = 26;

export const sphericalDp = (g: VireGlassGeometry, o: VireGlassOptics) =>
  o.refraction * SPHERICAL_PER_BEVEL * bevelDp(g, o);

export const chromaDp = (g: VireGlassGeometry, o: VireGlassOptics) =>
  o.dispersion * CHROMA_PER_BEVEL * bevelDp(g, o);

export const shadowReachDp = (g: VireGlassGeometry) =>
  Math.min(halfMinDp(g) * 0.16, 7);

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

/**
 * Шаг квантования запаса. Запас обязан ЛИШЬ покрывать выборку — точное значение не важно,
 * а вот менять его каждый кадр дорого: нативная вьюха линзы пере-раскладывается и заново
 * ставит `RenderEffect`. При перетаскивании панели и при морфинге запас плыл непрерывно,
 * и это давало заметные рывки. Округляем вверх до шага — размер меняется редко.
 */
const PAD_STEP = 8;
const quantise = (v: number) => Math.ceil(v / PAD_STEP) * PAD_STEP;

/**
 * Запас вьюхи линзы с каждой стороны: за его пределами шейдеру нечего семплировать.
 *
 * Сюда обязаны входить ЧЕТЫРЕ вещи. Выборка преломления с аберрациями. Радиус собственного
 * размытия — оно тоже семплирует вокруг точки. Радиус сбора света — кромка берёт его снаружи
 * формы, и без запаса она чернеет ровно там, где должна поймать окружение. И ход
 * перетаскивания: вьюха линзы едет за пальцем, а её границы — нет, и выборка вываливается за
 * край, отчего из-под стекла лезут слои.
 */
export function lensPadDp(
  g: VireGlassGeometry,
  o: VireGlassOptics,
  morph?: Parameters<typeof morphReachDp>[1],
  dragLimit = 0,
): number {
  const sampling = Math.max(
    edgePushDp(g, o) + sphericalDp(g, o) + chromaDp(g, o) + o.blur,
    o.gatherRadiusDp,
  );
  const stretch = halfMinDp(g) * MAX_STRETCH;
  return quantise(sampling + dragLimit + stretch + morphReachDp(g, morph) + 2);
}

/** Запас канваса поверхности: тень уходит наружу формы, а перетаскивание сдвигает её ещё. */
export function surfacePadDp(
  g: VireGlassGeometry,
  dragLimit = 0,
  morph?: Parameters<typeof morphReachDp>[1],
): number {
  return quantise(shadowReachDp(g) * 1.2 + dragLimit + morphReachDp(g, morph) + 2);
}

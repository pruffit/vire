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

/** Запас вьюхи под каплю, уходящую за пальцем: доля половины детали сверх самого хода тяги.
 *  Капля выходит за тело не дальше `dragLimit`, а сшивка добавляет к ней сглаживание — этот
 *  член его и покрывает. */
export const MAX_STRETCH = 0.34;

/**
 * Крупнее деталь — толще стекло: сильнее линза, глубже тень (reference.md §1). Фаска и
 * толщина материала заданы для детали с опорным полуразмером и растут как корень из размера.
 */
const SIZE_REF_DP = 24;
export const sizeGain = (g: VireGlassGeometry) =>
  Math.min(Math.max(Math.sqrt(halfMinDp(g) / SIZE_REF_DP), 0.8), 2.4);

/** Фаска шире этой доли полуразмера ломает SDF: закругления сходятся посередине. */
export const MAX_BEVEL_FRACTION = 0.65;

export const bevelFraction = (g: VireGlassGeometry, o: VireGlassOptics) =>
  Math.min(MAX_BEVEL_FRACTION, (o.bevelDp * sizeGain(g)) / halfMinDp(g));

export const bevelDp = (g: VireGlassGeometry, o: VireGlassOptics) =>
  Math.max(bevelFraction(g, o) * halfMinDp(g), 1);

export const thicknessDp = (g: VireGlassGeometry, o: VireGlassOptics) =>
  o.thicknessDp * sizeGain(g);

/** Высота стекла у самого силуэта, доля толщины: без неё у края нечему гнуть луч. */
export const RIM_FRACTION = 0.85;

export const rimDp = (g: VireGlassGeometry, o: VireGlassOptics) => thicknessDp(g, o) * RIM_FRACTION;

/** Крупнее деталь — глубже и шире тень (M 7:14). */
export const shadowReachDp = (g: VireGlassGeometry) =>
  Math.min(Math.max(halfMinDp(g) * 0.65, 6), 36);

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
  const sampling = Math.max(o.blur, o.gatherRadiusDp);
  const stretch = halfMinDp(g) * MAX_STRETCH;
  return quantise(sampling + dragLimit + stretch + morphReachDp(g, morph) + 2);
}

/**
 * Запас канваса поверхности: тень уходит наружу формы, а перетаскивание сдвигает её ещё.
 *
 * Множитель меньше, чем полный охват тени: под пальцем у поднимающегося органа шейдер домножает
 * радиус на 1.55, и самый дальний хвост в запас не попадает. Так и оставлено — на границе запаса
 * у него 1.2% альфы (до смягчения тени было 2.5%), а поднять множитель значит вырастить площадь
 * каждой вьюхи поверхности. Если хвост когда-нибудь проступит на устройстве — лечится здесь.
 */
export function surfacePadDp(
  g: VireGlassGeometry,
  dragLimit = 0,
  morph?: Parameters<typeof morphReachDp>[1],
): number {
  return quantise(shadowReachDp(g) * 1.2 + dragLimit + morphReachDp(g, morph) + 2);
}

/**
 * ПЛОТНОСТЬ ТЕНИ ПО ТОМУ, ЧТО ПОД ДЕТАЛЬЮ. Эталон 219 @11:47 дословно: «increases the opacity
 * of its shadow when it is over text… lowers the opacity of its shadow when it is over a solid
 * light background». Речь о контенте ЗА ДЕТАЛЬЮ, поэтому величина одна на деталь, а не поле по
 * площади тени.
 *
 * Закон живёт здесь, а не у стенда: пока он был вписан в веб-рендерер, на Android тени не
 * адаптировались вовсе. Концы сверены с эталоном по глубине провала под деталью —
 * docs/vireglass/benchmarks/2026-09-14-shadow-adaptation-vs-reference.md.
 */
const SHADOW_FLAT = 0.8;
const SHADOW_BUSY_GAIN = 6;
const SHADOW_BUSY_RISE = 1.2;
const SHADOW_STEP = 0.05;

export function shadowOpacity(busy: number): number {
  return SHADOW_FLAT + Math.min(Math.max(busy, 0) * SHADOW_BUSY_GAIN, SHADOW_BUSY_RISE);
}

/** То же для платформ, где замер идёт через состояние: огрублено, как и цвет окружения, иначе
 *  каждая выборка зонда гоняла бы перерисовку поверхности. */
export function shadowOpacityFrom(sample: { busy: number }): number {
  return Math.round(shadowOpacity(sample.busy) / SHADOW_STEP) * SHADOW_STEP;
}

import { bodyDensityFor, type BackdropSample } from './adaptation';

/**
 * ОЦЕНКА БЛОКА СТЕКЛА — чистая часть группы поверхностей (`glass-group.tsx`).
 *
 * Здесь живёт всё, что решает: плоскость светлоты по замерам участников, агрегаты блока,
 * требование к полярности и её гистерезис. React и нативный слой не нужны ни одному из
 * этих правил, поэтому они лежат отдельно от компонента и проверяются юнит-тестом.
 */

export type GroupMember = { x: number; y: number; sample: BackdropSample; legibility: number };

/** Оценка блока: центр и средняя светлота, наклон по x, самое светлое место и общие на всех
 *  величины замера — [пестрота, lo, hi, r, g, b]. */
export type GroupPlane = {
  mx: number;
  ml: number;
  slope: number;
  base: number;
  rest: number[];
};

/** Вход решения о полярности: светлота, по которой судит блок, и строжайшее из требований. */
export type GroupDecision = { decisive: number; legibility: number };

/** Предел стекла и возврат — те же, что у одиночной поверхности (`adaptation.ts`). */
export const FLIP_DENSITY = 0.48;
export const RETURN_DENSITY = 0.4;
export const CONFIRMATIONS = 3;

/** Доля нового замера в сглаженной оценке. Замеры идут от каждого участника, поэтому по
 *  блоку их набирается около двадцати в секунду — четверти хватает на отклик за ~200 мс. */
export const SMOOTH = 0.25;

/**
 * Доля наклона, которая доходит до участников.
 *
 * Плоскость по четырём точкам почти интерполирует их: над границей чёрного и белого кнопки
 * получали 0.0, 0.3, 0.7 и 1.0 — то есть ровно свои собственные значения, и блок опять
 * разваливался на независимые детали. Плотность задаёт САМОЕ СВЕТЛОЕ место блока,
 * наклон лишь слегка отпускает её на тёмном краю.
 */
export const GRADIENT = 0.35;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Плоскость светлоты по замерам участников. Наклон считается методом наименьших квадратов
 * по x: участники блока стоят в ряд, и одной оси достаточно — по вертикали их разброса нет.
 * Координаты центрируются, поэтому нормальные уравнения распадаются.
 */
export function fitLuma(members: readonly GroupMember[]): {
  mx: number;
  ml: number;
  slope: number;
} {
  const n = members.length;
  let mx = 0;
  let ml = 0;
  for (const m of members) {
    mx += m.x;
    ml += m.sample.luma;
  }
  mx /= n;
  ml /= n;
  let sxx = 0;
  let sxl = 0;
  for (const m of members) {
    const dx = m.x - mx;
    sxx += dx * dx;
    sxl += dx * m.sample.luma;
  }
  return { mx, ml, slope: sxx > 1e-6 ? sxl / sxx : 0 };
}

/** Оценка блока по его участникам. Пустой блок оценивать нечем — там `null`. */
export function aggregate(
  members: readonly GroupMember[],
): { plane: GroupPlane; decision: GroupDecision } | null {
  if (members.length === 0) return null;

  const { mx, ml, slope } = fitLuma(members);
  let busy = 0;
  let lo = 1;
  let hi = 0;
  // Самое светлое МЕСТО блока: по нему считается плотность на всех. Иначе над
  // границей чёрного и белого блок держится за среднее, светлая надпись не темнеет
  // ни на чём и тонет над светлой половиной.
  let base = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  // Требование читаемости — самое строгое в блоке: полярность одна на всех, и по
  // слабейшему требованию сосед с более придирчивой оптикой остался бы нечитаемым.
  let legibility = 0;
  for (const m of members) {
    busy = Math.max(busy, m.sample.busy);
    lo = Math.min(lo, m.sample.lo);
    hi = Math.max(hi, m.sample.hi);
    base = Math.max(base, m.sample.luma);
    r += m.sample.r;
    g += m.sample.g;
    b += m.sample.b;
    legibility = Math.max(legibility, m.legibility);
  }
  const k = members.length;
  return {
    plane: { mx, ml, slope, base, rest: [busy, lo, hi, r / k, g / k, b / k] },
    // Решение о полярности — одно на блок и по его СРЕДНЕЙ светлоте. По собственной
    // каждая кнопка решала сама, и на пёстром фоне блок получался разноцветным.
    decision: { decisive: ml * 0.75 + hi * 0.25, legibility },
  };
}

/**
 * Сглаживание по замерам, а не по кадрам: нативная линза сглаживает СВОЮ оценку, а
 * групповая перебивает её уже готовой. Без этого блок менял тон ступенями — шаг зонда
 * 180 мс слишком крупный, чтобы адаптация читалась незаметной.
 */
export function smoothPlane(prev: GroupPlane | null, next: GroupPlane): GroupPlane {
  if (!prev) return next;
  const e = (was: number, now: number) => was + (now - was) * SMOOTH;
  return {
    mx: next.mx,
    ml: e(prev.ml, next.ml),
    slope: e(prev.slope, next.slope),
    base: e(prev.base, next.base),
    rest: next.rest.map((v, i) => e(prev.rest[i], v)),
  };
}

/** Замер, который участник в точке `x` отдаёт своей линзе — в порядке её пропа. */
export function probeValuesAt(plane: GroupPlane, x: number): number[] {
  // От самого светлого места блока вниз — ровно настолько, насколько это место темнее
  // по плоскости, и то лишь долей GRADIENT. Тёмному краю это отпускает плотность,
  // но не отменяет её: блок остаётся одним материалом.
  const here = plane.ml + plane.slope * (x - plane.mx);
  const luma = clamp01(plane.base - (plane.base - here) * GRADIENT);
  // Наклон в линзу не уезжает: групповой измерен в dp экрана, а шейдер умножает
  // `u_probeSlope` на нормированную позицию внутри детали — размерности разные.
  return [luma, plane.rest[0], plane.rest[1], plane.rest[2], 0, 0, plane.rest[3], plane.rest[4], plane.rest[5]];
}

/** Требует ли блок сменить полярность надписи при текущей (1 светлая, 0 тёмная). */
export function wantsPolarityChange(decision: GroupDecision, polarity: number): boolean {
  const cost = bodyDensityFor(decision.decisive, decision.legibility, 0, 1);
  return polarity === 1 ? cost > FLIP_DENSITY : cost < RETURN_DENSITY;
}

export type GroupSink = {
  /** Оценка блока пересчитана: из неё участники берут свои значения. */
  plane: (plane: GroupPlane | null) => void;
  /** Блок меняет полярность надписи на всех сразу. */
  flip: (polarity: number) => void;
};

export type GroupState = {
  report: (
    id: string,
    x: number,
    y: number,
    sample: BackdropSample,
    legibility: number,
  ) => void;
  release: (id: string) => void;
  plane: () => GroupPlane | null;
  polarity: () => number;
  confirmations: () => number;
};

/** Состояние блока: участники, сглаженная оценка и гистерезис полярности. */
export function createGroupState(sink: GroupSink): GroupState {
  const members = new Map<string, GroupMember>();
  let plane: GroupPlane | null = null;
  let pending = 0;
  let polarity = 1;

  const measure = (): GroupDecision | null => {
    const next = aggregate([...members.values()]);
    if (!next) {
      pending = 0;
      plane = null;
      sink.plane(null);
      return null;
    }
    plane = smoothPlane(plane, next.plane);
    sink.plane(plane);
    return next.decision;
  };

  return {
    report(id, x, y, sample, legibility) {
      members.set(id, { x, y, sample, legibility });
      const decision = measure();
      if (!decision) return;
      if (!wantsPolarityChange(decision, polarity)) {
        pending = 0;
        return;
      }
      pending += 1;
      if (pending < CONFIRMATIONS) return;
      pending = 0;
      polarity = polarity === 1 ? 0 : 1;
      sink.flip(polarity);
    },
    // Только пересчёт оценки: снятие участника не замер фона, и считать его подтверждением
    // полярности нельзя — размонтирование блока набирало CONFIRMATIONS мгновенно и запускало
    // перекраску, отменить которую уже некому.
    release(id) {
      if (members.delete(id)) measure();
    },
    plane: () => plane,
    polarity: () => polarity,
    confirmations: () => pending,
  };
}

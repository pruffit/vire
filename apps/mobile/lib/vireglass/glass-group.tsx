import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { bodyDensityFor, type BackdropSample } from './adaptation';

/**
 * ГРУППА ПОВЕРХНОСТЕЙ — блок стекла, который адаптируется целиком.
 *
 * Каждая линза видит свой кусок фона, и по собственному замеру одна кнопка навигации уходит
 * в тень, а соседняя остаётся прозрачной; на пёстром фоне у них ещё и полярность надписи
 * расходится. Блок при этом перестаёт читаться блоком и разваливается на отдельные детали.
 *
 * Группа собирает замеры участников, считает ОДНУ оценку на всех и возвращает её каждому.
 * Тонирование при этом остаётся градиентным: по замерам участников строится плоскость
 * светлоты, и каждый берёт из неё значение в своей точке — блок темнеет плавно поперёк
 * себя, а не ступенями по кнопкам.
 */

export type GroupProbe = {
  /** Светлота, пестрота, lo, hi, наклон по осям, средний цвет — в порядке пропа линзы. */
  values: number[];
  /** Полярность надписи на весь блок: 1 светлая, 0 тёмная. */
  ink: number;
};

type Member = { x: number; y: number; sample: BackdropSample };

/**
 * Шина тяги: [x, y, радиус капли, ширина шейки, номер тянущего]. Живёт разделяемым значением,
 * а не состоянием, потому что читают её ворклеты соседей на КАЖДОМ кадре тяги — через React
 * это был бы рендер блока на кадр.
 *
 * Благодаря ей капля видна не только тому, из кого её тянут: сосед добавляет её себе второй
 * формой, и на подходе две детали сливаются в одну — материал ведёт себя как материал, а не
 * как набор независимых кнопок.
 */
export type PullBus = SharedValue<number[]>;

type GroupApi = {
  report: (id: string, x: number, y: number, sample: BackdropSample) => void;
  probeAt: (x: number) => number[] | undefined;
  ink: number | undefined;
  pull: PullBus;
  /** Номер участника в группе. Свою каплю тянущий рисует сам, чужую — как приходящую. */
  claim: () => number;
};

const GlassGroupContext = createContext<GroupApi | null>(null);

/** Предел стекла и возврат — те же, что у одиночной поверхности (`adaptation.ts`). */
const FLIP_DENSITY = 0.48;
const RETURN_DENSITY = 0.4;
const CONFIRMATIONS = 3;
const FADE_MS = 420;

/** Доля нового замера в сглаженной оценке. Замеры идут от каждого участника, поэтому по
 *  блоку их набирается около двадцати в секунду — четверти хватает на отклик за ~200 мс. */
const SMOOTH = 0.25;

/**
 * Доля наклона, которая доходит до участников.
 *
 * Плоскость по четырём точкам почти интерполирует их: над границей чёрного и белого кнопки
 * получали 0.0, 0.3, 0.7 и 1.0 — то есть ровно свои собственные значения, и блок опять
 * разваливался на независимые детали. Плотность задаёт САМОЕ СВЕТЛОЕ место блока,
 * наклон лишь слегка отпускает её на тёмном краю.
 */
const GRADIENT = 0.35;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Плоскость светлоты по замерам участников. Наклон считается методом наименьших квадратов
 * поx: участники блока стоят в ряд, и одной оси достаточно — по вертикали их разброса нет.
 * Координаты центрируются, поэтому нормальные уравнения распадаются.
 */
function fit(members: Member[]) {
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

export function GlassGroup({ children }: { children: ReactNode }) {
  const members = useRef(new Map<string, Member>());
  const pull = useSharedValue([0, 0, 0, 0, -1]);
  const seats = useRef(0);
  const claim = useCallback(() => {
    seats.current += 1;
    return seats.current;
  }, []);
  const [probe, setProbe] = useState<{
    mx: number;
    ml: number;
    slope: number;
    base: number;
    rest: number[];
  } | null>(null);
  const [ink, setInk] = useState(1);

  const target = useRef(1);
  const current = useRef(1);
  const pending = useRef(0);
  const from = useRef(1);
  const startedAt = useRef(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const animate = useCallback(() => {
    const step = () => {
      const t = Math.min((Date.now() - startedAt.current) / FADE_MS, 1);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
      current.current = from.current + (target.current - from.current) * e;
      setInk(current.current);
      raf.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
  }, []);

  const report = useCallback(
    (id: string, x: number, y: number, sample: BackdropSample) => {
      members.current.set(id, { x, y, sample });
      const all = [...members.current.values()];
      if (all.length === 0) return;

      const { mx, ml, slope } = fit(all);
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
      for (const m of all) {
        busy = Math.max(busy, m.sample.busy);
        lo = Math.min(lo, m.sample.lo);
        hi = Math.max(hi, m.sample.hi);
        base = Math.max(base, m.sample.luma);
        r += m.sample.r;
        g += m.sample.g;
        b += m.sample.b;
      }
      const k = all.length;
      // Сглаживание по замерам, а не по кадрам: нативная линза сглаживает СВОЮ оценку, а
      // групповая перебивает её уже готовой. Без этого блок менял тон ступенями — шаг зонда
      // 180 мс слишком крупный, чтобы адаптация читалась незаметной.
      setProbe((prev) => {
        const next = { mx, ml, slope, base, rest: [busy, lo, hi, r / k, g / k, b / k] };
        if (!prev) return next;
        const e = (was: number, now: number) => was + (now - was) * SMOOTH;
        return {
          mx,
          ml: e(prev.ml, ml),
          slope: e(prev.slope, slope),
          base: e(prev.base, base),
          rest: next.rest.map((v, i) => e(prev.rest[i], v)),
        };
      });

      // Решение о полярности — одно на блок и по его СРЕДНЕЙ светлоте. По собственной
      // каждая кнопка решала сама, и на пёстром фоне блок получался разноцветным.
      const decisive = ml * 0.75 + hi * 0.25;
      const cost = bodyDensityFor(decisive, 0.26, 0, 1);
      const wasLight = target.current === 1;
      const wants = wasLight ? cost > FLIP_DENSITY : cost < RETURN_DENSITY;
      if (!wants) {
        pending.current = 0;
        return;
      }
      pending.current += 1;
      if (pending.current < CONFIRMATIONS) return;
      pending.current = 0;
      from.current = current.current;
      target.current = wasLight ? 0 : 1;
      startedAt.current = Date.now();
      animate();
    },
    [animate],
  );

  const probeAt = useCallback(
    (x: number) => {
      if (!probe) return undefined;
      // Светлота в точке участника берётся из общей плоскости. Наклон уезжает в линзу как
      // есть: внутри детали она доводит тонирование до градиента сама.
      // От самого светлого места блока вниз — ровно настолько, насколько это место темнее
      // по плоскости, и то лишь долей GRADIENT. Тёмному краю это отпускает плотность,
      // но не отменяет её: блок остаётся одним материалом.
      const here = probe.ml + probe.slope * (x - probe.mx);
      const luma = clamp01(probe.base - (probe.base - here) * GRADIENT);
      return [luma, probe.rest[0], probe.rest[1], probe.rest[2], 0, 0, probe.rest[3], probe.rest[4], probe.rest[5]];
    },
    [probe],
  );

  const api = useMemo<GroupApi>(
    () => ({ report, probeAt, ink, pull, claim }),
    [report, probeAt, ink, pull, claim],
  );

  return <GlassGroupContext.Provider value={api}>{children}</GlassGroupContext.Provider>;
}

/** Внутри группы поверхность отдаёт замер ей и берёт у неё общую оценку. Вне группы — null. */
export function useGlassGroup(): GroupApi | null {
  return useContext(GlassGroupContext);
}

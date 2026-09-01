import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { BackdropSample } from './adaptation';
import {
  createGroupState,
  probeValuesAt,
  type GroupPlane,
  type GroupState,
} from './group-model';

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
  report: (
    id: string,
    x: number,
    y: number,
    sample: BackdropSample,
    legibility: number,
  ) => void;
  /** Снять участника с учёта при размонтировании: иначе он навсегда остаётся в оценке блока. */
  release: (id: string) => void;
  probeAt: (x: number) => number[] | undefined;
  ink: number | undefined;
  pull: PullBus;
  /** Номер участника в группе. Свою каплю тянущий рисует сам, чужую — как приходящую. */
  claim: () => number;
};

const GlassGroupContext = createContext<GroupApi | null>(null);

/** Длительность перекраски — та же, что у одиночной поверхности (`adaptation.ts`). */
const FADE_MS = 420;

export function GlassGroup({ children }: { children: ReactNode }) {
  const pull = useSharedValue([0, 0, 0, 0, -1]);
  const seats = useRef(0);
  const claim = useCallback(() => {
    seats.current += 1;
    return seats.current;
  }, []);
  const [plane, setPlane] = useState<GroupPlane | null>(null);
  const [ink, setInk] = useState(1);

  const target = useRef(1);
  const current = useRef(1);
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

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
  }, []);

  const flip = useCallback(
    (polarity: number) => {
      from.current = current.current;
      target.current = polarity;
      startedAt.current = Date.now();
      animate();
    },
    [animate],
  );
  // Состояние блока создаётся один раз, а колбэк пересобирается вместе с рендером —
  // поэтому в состояние уезжает ссылка на него, а не он сам.
  const flipRef = useRef(flip);
  flipRef.current = flip;

  const state = useRef<GroupState | null>(null);
  if (state.current === null) {
    state.current = createGroupState({
      plane: setPlane,
      flip: (polarity) => flipRef.current(polarity),
    });
  }
  const group = state.current;

  const probeAt = useCallback(
    (x: number) => (plane ? probeValuesAt(plane, x) : undefined),
    [plane],
  );

  const api = useMemo<GroupApi>(
    () => ({ report: group.report, release: group.release, probeAt, ink, pull, claim }),
    [group, probeAt, ink, pull, claim],
  );

  return <GlassGroupContext.Provider value={api}>{children}</GlassGroupContext.Provider>;
}

/** Внутри группы поверхность отдаёт замер ей и берёт у неё общую оценку. Вне группы — null. */
export function useGlassGroup(): GroupApi | null {
  return useContext(GlassGroupContext);
}

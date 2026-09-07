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
import { FADE_MS, type BackdropSample } from './adaptation';
import { createGroupState, type GroupState } from './group-model';

/**
 * ГРУППА ПОВЕРХНОСТЕЙ — блок стекла, который адаптируется целиком.
 *
 * Каждая линза видит свой кусок фона, и по собственному замеру одна кнопка навигации уходит
 * в тень, а соседняя остаётся прозрачной; на пёстром фоне у них ещё и полярность надписи
 * расходится. Блок при этом перестаёт читаться блоком и разваливается на отдельные детали.
 *
 * Группа собирает замеры участников и возвращает всем ОДНУ полярность краски.
 *
 * Оценку СРЕДЫ она больше не раздаёт: та живёт в самой линзе, как в вебе, — общая перебивала
 * собственный зонд детали, и при одном материале «Поток» и навигация адаптировались к фону
 * по-разному. Вместе с ней ушла и шина тяги: тянут не деталь, а поле вокруг пятна касания
 * (`createDeform` в ядре), и сливать соседние поверхности каплей нечем.
 */
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
  ink: number | undefined;
};

const GlassGroupContext = createContext<GroupApi | null>(null);

export function GlassGroup({ children }: { children: ReactNode }) {
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
    // Плоскость светлоты блока ядро всё ещё считает, но читать её некому: среду каждая
    // линза оценивает сама. Здесь остаётся полярность краски.
    state.current = createGroupState({
      plane: () => {},
      flip: (polarity) => flipRef.current(polarity),
    });
  }
  const group = state.current;

  const api = useMemo<GroupApi>(
    () => ({ report: group.report, release: group.release, ink }),
    [group, ink],
  );

  return <GlassGroupContext.Provider value={api}>{children}</GlassGroupContext.Provider>;
}

/** Внутри группы поверхность отдаёт замер ей и берёт у неё общую оценку. Вне группы — null. */
export function useGlassGroup(): GroupApi | null {
  return useContext(GlassGroupContext);
}

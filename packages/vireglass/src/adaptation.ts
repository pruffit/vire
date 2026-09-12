import { useCallback, useEffect, useRef, useState } from 'react';
import type { VireGlassOptics } from './material';

/**
 * Автоматическая полярность контента над стеклом.
 *
 * Стекло само подстраивает своё тело под фон — но у этого есть предел. Когда фон светлый
 * И надпись поверх светлая, никакая плотность тела уже не разведёт их по контрасту: тело
 * упирается в свой потолок, а буквы тонут. Дальше решение принимает не стекло, а
 * приложение — оно перекрашивает надпись в противоположную сторону, и вся автоматика
 * стекла перестраивается следом сама, потому что зависит от той же полярности.
 *
 * Светлоту фона ПОД стеклом приложению неоткуда взять: она видна только нативному захвату.
 * Оттуда она и приходит — событием `onBackdropSample` (зонд в `GlassBackdropView`).
 *
 * Решение принимается ПО СВЕТЛОТЕ с гистерезисом: считать здесь плотность тела по формуле
 * шейдера значит держать вторую реализацию модели, которая разъезжается с первой молча.
 * Что тело и надпись действительно расходятся по контрасту, проверяет `check:optics` —
 * на настоящем рендере, а не на копии формулы.
 */

export type BackdropSample = {
  /** Средняя светлота фона под стеклом, 0..1, в той же (sRGB-кодированной) шкале, что и экран. */
  luma: number;
  /** Размах светлоты (hi − lo): 0 на ровной заливке, ~1 на границе чёрного и белого. */
  busy: number;
  /** Самое тёмное и самое светлое место под стеклом. Решение о читаемости принимается по
   *  ним, а не по среднему: над границей чёрного и белого среднее — «всё в порядке». */
  lo: number;
  hi: number;
  r: number;
  g: number;
  b: number;
};

/** Шаг огрубления цвета окружения. Тень красится им грубо, а на мобилке каждая выборка зонда
 *  иначе дёргала бы перерисовку поверхности: замер приходит раз в 180 мс. */
const AMBIENT_STEP = 32;

/** Цвет окружения детали из замера зонда — тот, что затекает в её тень (reference.md §7). */
export function ambientFrom(sample: { r: number; g: number; b: number }): [number, number, number] {
  const step = (v: number) => Math.round(Math.min(Math.max(v, 0), 1) * AMBIENT_STEP) / AMBIENT_STEP;
  return [step(sample.r), step(sample.g), step(sample.b)];
}

/** Светлота надписи на концах шкалы. Кит держит светлый текст почти белым, тёмный — почти
 *  чёрным; промежуточных состояний у полярности не бывает по построению. */
export const INK_LIGHT = 0.95;
export const INK_DARK = 0.08;

/**
 * Полярность надписи по замеру фона — ОДНО место на все платформы. Мелкая деталь и её глифы
 * переключаются между светлым и тёмным так, чтобы контраст был наибольшим (reference.md §3):
 * над жёлтым цветком у эталона глифы уже чёрные, а стекло светлое. Удерживать светлую надпись
 * плотностью тела на светлом фоне значит превратить деталь в крашеную плашку.
 *
 * Решение по светлоте с уклоном в светлую сторону — не по среднему (белый экран с тёмной
 * полосой иначе не переключится) и не по максимуму (одна светлая обложка под краем
 * перекрасила бы всю панель). Гистерезис внутри; число подтверждений решает вызывающий.
 */
export function shouldInkBeLight(sample: { luma: number; hi?: number }, wasLight: boolean): boolean {
  return decisiveLuma(sample) < (wasLight ? FLIP_LUMA : RETURN_LUMA);
}

export const decisiveLuma = (sample: { luma: number; hi?: number }) =>
  sample.luma * 0.75 + (sample.hi ?? sample.luma) * 0.25;

/** Светлее этого светлая надпись уходит в тёмную. */
export const FLIP_LUMA = 0.62;
/** Обратно — заметно раньше, чем вперёд: без зазора надпись мигала бы на каждой светлой
 *  обложке, проехавшей под краем стекла. */
export const RETURN_LUMA = 0.5;
/** Сколько подряд замеров должны требовать смены. Зонд снимает ~5 раз в секунду, поэтому
 *  три замера — это примерно полсекунды устойчивого фона, а не случайная обложка под краем. */
export const CONFIRMATIONS = 3;
/** Длительность перекраски. Достаточно медленно, чтобы не читаться событием, и достаточно
 *  быстро, чтобы нечитаемое состояние не жило заметно долго. */
export const FADE_MS = 420;

export type GlassAdaptation = {
  /** Полярность надписи: 1 светлая, 0 тёмная. Едет плавно между концами. */
  ink: number;
  /** Последний замер фона — из него берут акцент и подсказки для отладки. */
  sample: BackdropSample | null;
  /** Отдать в `VireGlassSurface`. */
  onBackdropSample: (e: { nativeEvent: BackdropSample }) => void;
};

/**
 * Полярность контента, которая сама следует за фоном под стеклом.
 *
 * `initial` — полярность, с которой экран начинает (обычно светлая надпись на тёмной теме).
 * `enabled = false` замораживает её: экран, который сам знает свой контент, вправе не
 * отдавать решение автоматике.
 */
export function useGlassAdaptation(
  optics: Pick<VireGlassOptics, 'legibility' | 'bodyDensity' | 'ink' | 'edgeLight'>,
  options: { enabled?: boolean } = {},
): GlassAdaptation {
  const enabled = options.enabled ?? true;
  const [ink, setInk] = useState(optics.ink);
  const [sample, setSample] = useState<BackdropSample | null>(null);

  const target = useRef(optics.ink > 0.5 ? 1 : 0);
  // Текущее значение живёт и в ссылке: без неё колбэк зависел бы от состояния и
  // пересоздавался КАЖДЫЙ кадр перекраски, то есть менял бы проп нативной вьюхи 60 раз в
  // секунду просто из-за смены идентичности функции.
  const current = useRef(optics.ink);
  const lastSample = useRef<BackdropSample | null>(null);
  const pending = useRef(0);
  const from = useRef(optics.ink);
  const startedAt = useRef(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  // Перекраска идёт по кадрам, а не пружиной ворклета: значение уезжает не только в цвет
  // текста, но и в униформу линзы, а та ставится пропом — то есть из React-рендера.
  const animate = useCallback(() => {
    const step = () => {
      const t = Math.min((Date.now() - startedAt.current) / FADE_MS, 1);
      // Косинусное сглаживание: линейный переход виден как движение, этот — нет.
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

  const onBackdropSample = useCallback(
    (e: { nativeEvent: BackdropSample }) => {
      const next = e.nativeEvent;
      // Замер приходит несколько раз в секунду. В состояние он кладётся только когда реально
      // сдвинулся: иначе каждый замер тянул бы за собой перерисовку потребителя.
      const prev = lastSample.current;
      if (
        prev === null ||
        Math.abs(prev.luma - next.luma) > 0.01 ||
        Math.abs(prev.busy - next.busy) > 0.02
      ) {
        lastSample.current = next;
        setSample(next);
      }
      if (!enabled) return;

      const wasLight = target.current === 1;
      // Само решение — в `shouldInkBeLight`: одно место на все платформы. Здесь остаётся
      // только политика подтверждений, она у приложения своя.
      const wants = shouldInkBeLight(next, wasLight) !== wasLight;
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
    [enabled, animate],
  );

  return { ink, sample, onBackdropSample };
}

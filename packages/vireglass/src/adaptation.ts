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
 * Решение принимается по ТОЙ ЖЕ формуле, по которой стекло красит своё тело
 * (`lens-shader.ts`). Иначе приложение судило бы по одной физике, а видел бы пользователь
 * другую — и перекраска включалась бы не там, где надпись действительно тонет.
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

// Константы модели тела — те же, что в шейдере линзы. Дублирование здесь осознанное и
// закрыто тестом: держать их в одном месте нельзя, шейдер это строка на другом языке.
const TINT_DARK = 0.07;
const TINT_LIGHT = 0.94;
const BODY_CAP_LOOSE = 0.62;
const BODY_CAP_TIGHT = 0.38;
const MAX_DENSITY = 0.92;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Потолок светлоты тела для СВЕТЛОЙ надписи. Порог задан контрастом, а не разностью
 *  светлот: «на 0.14 темнее белого» — это светлота 0.86, на которой белый текст не виден
 *  вовсе. Для тёмной надписи порог зеркальный. */
export function bodyCap(legibility: number): number {
  return BODY_CAP_LOOSE + (BODY_CAP_TIGHT - BODY_CAP_LOOSE) * clamp(legibility * 2, 0, 1);
}

/**
 * Плотность, которую тело обязано набрать над фоном светлоты `local`, чтобы надпись данной
 * полярности осталась читаемой. Повторяет `lens-shader.ts`.
 */
export function bodyDensityFor(
  local: number,
  legibility: number,
  bodyDensity: number,
  polarity: number,
  spread = 0,
): number {
  const cap = bodyCap(legibility);
  const need =
    polarity > 0.5
      ? local > cap
        ? clamp((local - cap) / Math.max(local - TINT_DARK, 1e-4), 0, MAX_DENSITY)
        : 0
      : local < 1 - cap
        ? clamp((1 - cap - local) / Math.max(TINT_LIGHT - local, 1e-4), 0, MAX_DENSITY)
        : 0;
  // Разнородный фон поднимает плотность сам по себе: разделения по светлоте там не хватает
  // ни при какой полярности. Формула та же, что в шейдере.
  const s = clamp(spread, 0, 1);
  const busyFloor = s * (0.15 + (0.85 - 0.15) * clamp(legibility, 0, 1));
  return Math.max(bodyDensity, need, busyFloor);
}

/**
 * Светлота тела стекла, которой оно ДОБЬЁТСЯ при данной полярности над фоном светлоты
 * `local`.
 */
export function bodyLuma(
  local: number,
  legibility: number,
  bodyDensity: number,
  polarity: number,
  spread = 0,
  edgeLight = 0,
): number {
  const tint = polarity > 0.5 ? TINT_DARK : TINT_LIGHT;
  const density = bodyDensityFor(local, legibility, bodyDensity, polarity, spread);
  // Подсветка окружения поднимает светлоту тела ПОСЛЕ тинта — та же формула, что в шейдере.
  // Без этого слагаемого решение принималось бы по светлоте, которой на экране нет.
  const lift = local * edgeLight * (0.12 + 0.55 * (1 - local));
  return clamp(local + (tint - local) * density + lift, 0, 1);
}

/** Относительная яркость по WCAG: экран отдаёт sRGB, а контраст считается в линейном. */
export function relativeLuminance(srgb: number): number {
  const v = clamp(srgb, 0, 1);
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(a: number, b: number): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

/** Светлота надписи на концах шкалы. Кит держит светлый текст почти белым, тёмный — почти
 *  чёрным; промежуточных состояний у полярности не бывает по построению. */
export const INK_LIGHT = 0.95;
export const INK_DARK = 0.08;

export type PolarityDecision = {
  /** Контраст надписи с телом стекла при светлой и при тёмной полярности. Решение по ним
   *  принимает вызывающий: ему нужно знать, какая полярность СЕЙЧАС. */
  light: number;
  dark: number;
};

/**
 * Какая полярность даёт надписи больше контраста над этим фоном. Возвращает обе величины —
 * решение о переключении принимает вызывающий, потому что ему нужен ещё и гистерезис.
 */
export function preferredPolarity(
  local: number,
  legibility: number,
  bodyDensity: number,
  range: { lo: number; hi: number } = { lo: local, hi: local },
  edgeLight = 0,
): PolarityDecision {
  // Контраст считается в ХУДШЕМ месте под стеклом: светлой надписи мешает самый светлый
  // участок, тёмной — самый тёмный. По среднему решать нельзя — над границей чёрного и
  // белого оно даёт серый, при котором формально всё в порядке, а надпись тонет над
  // светлой половиной.
  const spread = Math.max(range.hi - range.lo, 0);
  const light = contrastRatio(
    INK_LIGHT,
    bodyLuma(range.hi, legibility, bodyDensity, 1, spread, edgeLight),
  );
  const dark = contrastRatio(
    INK_DARK,
    bodyLuma(range.lo, legibility, bodyDensity, 0, spread, edgeLight),
  );
  return { light, dark };
}

/**
 * ПРЕДЕЛ СТЕКЛА. Перекраска включается не тогда, когда падает контраст, а тогда, когда цена
 * его удержания перестаёт быть приемлемой: чтобы держать светлую надпись над очень светлым
 * фоном, тело должно затемниться так, что деталь перестаёт быть стеклом и становится
 * крашеной плашкой. Это и есть «все функции автоматического контроля отработали в адекватном
 * пределе» — дальше слово за приложением.
 *
 * По контрасту решать нельзя: он падает и на насыщенном жёлтом, и тогда светлые иконки
 * перекрашивались в тёмные на цветных блоках. Правило продукта — надпись светлая везде,
 * кроме ОЧЕНЬ светлого фона; на цветном её вытягивает плотность тела, а не смена цвета.
 */
// 0.48 выбрано по насыщенному жёлтому: его светлота 0.78 — самая высокая среди цветов,
// которые обязаны остаться под БЕЛОЙ надписью. Перекраска начинается примерно с 0.90, то
// есть только на действительно очень светлом фоне.
export const FLIP_DENSITY = 0.48;
/** Обратно — заметно раньше, чем вперёд: без этого зазора надпись мигала бы на каждой
 *  светлой обложке, проехавшей под краем стекла. */
export const RETURN_DENSITY = 0.4;
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

      // Решение принимается по светлоте с уклоном в СВЕТЛУЮ сторону, а не по среднему и не
      // по самому светлому месту. По среднему — преимущественно белый экран с тёмной
      // полосой не переключался бы; по максимуму — одна светлая обложка под краем стекла
      // перекрашивала бы всю панель.
      const hi = next.hi ?? next.luma;
      const decisive = next.luma * 0.75 + hi * 0.25;
      const cost = bodyDensityFor(decisive, optics.legibility, 0, 1);
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
    [enabled, optics.legibility, animate],
  );

  return { ink, sample, onBackdropSample };
}

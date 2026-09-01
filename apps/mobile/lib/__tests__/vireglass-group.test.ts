import { describe, expect, it } from 'vitest';
import type { BackdropSample } from '../vireglass/adaptation';
import {
  aggregate,
  CONFIRMATIONS,
  createGroupState,
  GRADIENT,
  probeValuesAt,
  smoothPlane,
  type GroupMember,
  type GroupPlane,
} from '../vireglass/group-model';

const LEGIBILITY = 0.26;

/** Ровный фон: lo и hi совпадают со светлотой, цвет серый — проверяется сама оценка блока. */
const sample = (luma: number): BackdropSample => ({
  luma,
  busy: 0,
  lo: luma,
  hi: luma,
  r: luma,
  g: luma,
  b: luma,
});

const member = (x: number, luma: number, legibility = LEGIBILITY): GroupMember => ({
  x,
  y: 0,
  sample: sample(luma),
  legibility,
});

function makeState() {
  const planes: (GroupPlane | null)[] = [];
  const flips: number[] = [];
  const state = createGroupState({
    plane: (p) => planes.push(p),
    flip: (p) => flips.push(p),
  });
  const report = (id: string, x: number, luma: number, legibility = LEGIBILITY) =>
    state.report(id, x, 0, sample(luma), legibility);
  return { state, planes, flips, report };
}

describe('оценка блока по участникам', () => {
  it('пустой блок оценивать нечем', () => {
    expect(aggregate([])).toBeNull();
  });

  it('снятие участника пересчитывает оценку блока', () => {
    const { state, planes, report } = makeState();
    report('a', 0, 0.2);
    report('b', 100, 0.8);
    const before = state.plane();
    expect(before).not.toBeNull();

    state.release('b');
    const after = state.plane();
    expect(planes.length).toBe(3);
    // Оценка едет к оставшемуся участнику: ушедший больше не тянет её на светлую сторону.
    expect(after?.base).toBeLessThan(before?.base ?? 0);
    expect(after?.ml).toBeLessThan(before?.ml ?? 0);
  });

  it('уход последнего участника сбрасывает оценку', () => {
    const { state, planes, report } = makeState();
    report('a', 0, 0.8);
    expect(state.plane()).not.toBeNull();

    state.release('a');
    expect(state.plane()).toBeNull();
    expect(planes.at(-1)).toBeNull();
  });

  it('снятие того, кого в блоке нет, ничего не трогает', () => {
    const { state, planes, report } = makeState();
    report('a', 0, 0.8);
    state.release('b');
    expect(planes.length).toBe(1);
    expect(state.plane()).not.toBeNull();
  });

  it('оценка едет к новому замеру долей SMOOTH, а не прыжком', () => {
    const first = aggregate([member(0, 0)])?.plane as GroupPlane;
    const second = aggregate([member(0, 1)])?.plane as GroupPlane;
    // Первый замер брать не с чего — он и есть оценка.
    expect(smoothPlane(null, first)).toBe(first);
    const smoothed = smoothPlane(first, second);
    expect(smoothed.ml).toBeGreaterThan(first.ml);
    expect(smoothed.ml).toBeLessThan(second.ml);
  });
});

describe('полярность блока', () => {
  // Настоящая находка ревью: `release` шёл в общий путь с решением о полярности, и
  // размонтирование блока набирало подтверждения мгновенно.
  it('снятие участника не двигает счётчик подтверждений', () => {
    const { state, flips, report } = makeState();
    report('a', 0, 0.95);
    report('b', 100, 0.95);
    expect(state.confirmations()).toBe(2);

    state.release('b');
    expect(state.confirmations()).toBe(2);
    expect(state.polarity()).toBe(1);
    expect(flips).toEqual([]);
  });

  it('перекраска требует CONFIRMATIONS замеров подряд', () => {
    const { state, flips, report } = makeState();
    for (let i = 1; i < CONFIRMATIONS; i += 1) report('a', 0, 0.95);
    expect(flips).toEqual([]);

    report('a', 0, 0.95);
    expect(flips).toEqual([0]);
    expect(state.polarity()).toBe(0);
    expect(state.confirmations()).toBe(0);
  });

  it('замер в пределах стекла обнуляет набранные подтверждения', () => {
    const { state, report } = makeState();
    report('a', 0, 0.95);
    expect(state.confirmations()).toBe(1);
    report('a', 0, 0.3);
    expect(state.confirmations()).toBe(0);
  });

  it('требование читаемости блок берёт строгейшее из участников', () => {
    const decision = aggregate([member(0, 0.72, 0.05), member(100, 0.72, 0.6)])?.decision;
    expect(decision?.legibility).toBe(0.6);
  });

  // На этом фоне нетребовательному участнику стекла хватает, а придирчивому уже нет.
  // По первому попавшемуся требованию блок остался бы со светлой надписью на обоих.
  it('придирчивый участник перекрашивает весь блок, нетребовательный — нет', () => {
    const lax = makeState();
    const strict = makeState();
    for (let i = 0; i < CONFIRMATIONS; i += 1) {
      lax.report('a', 0, 0.72, 0.05);
      lax.report('b', 100, 0.72, 0.05);
      strict.report('a', 0, 0.72, 0.05);
      strict.report('b', 100, 0.72, 0.6);
    }
    expect(lax.flips).toEqual([]);
    expect(strict.flips).toEqual([0]);
  });
});

describe('плоскость светлоты у участников', () => {
  // Граница чёрного и белого поперёк блока: без демпфирования участники получают ровно
  // свои значения, и блок разваливается на независимые детали.
  const edge = [member(0, 0), member(1, 0.3), member(2, 0.7), member(3, 1)];
  const plane = aggregate(edge)?.plane as GroupPlane;
  const at = edge.map((m) => probeValuesAt(plane, m.x)[0]);

  it('плотность задаёт самое светлое место блока', () => {
    expect(plane.base).toBe(1);
    expect(at[3]).toBeCloseTo(plane.base, 5);
  });

  it('над границей чёрного и белого участники не получают своих значений', () => {
    // Каждый уехал от своего замера к самому светлому месту блока больше чем наполовину.
    for (const [i, m] of edge.entries()) {
      const own = m.sample.luma;
      if (own < plane.base) expect(at[i]).toBeGreaterThan(own + 0.6 * (plane.base - own));
    }
    expect(at[0]).toBeGreaterThan(0.6);
  });

  it('разброс по блоку ужат до доли GRADIENT', () => {
    const own = 1 - 0;
    expect(Math.max(...at) - Math.min(...at)).toBeLessThanOrEqual(GRADIENT * own * 1.05);
  });

  it('светлота убывает к тёмному краю — блок тонируется градиентом, а не ступенями', () => {
    for (let i = 1; i < at.length; i += 1) expect(at[i]).toBeGreaterThan(at[i - 1] - 1e-9);
    expect(at[0]).toBeLessThan(at[3]);
  });

  // Групповой наклон измерен в dp экрана, а шейдер умножает `u_probeSlope` на позицию
  // внутри детали: передать его «как есть» — сдвинуть тонирование на порядки.
  it('наклон плоскости в линзу не уезжает', () => {
    expect(plane.slope).toBeGreaterThan(0);
    const values = probeValuesAt(plane, 0);
    expect(values).toHaveLength(9);
    expect(values[4]).toBe(0);
    expect(values[5]).toBe(0);
  });

  it('остальные величины замера в блоке общие', () => {
    const mixed = aggregate([
      { ...member(0, 0.2), sample: { luma: 0.2, busy: 0.1, lo: 0.1, hi: 0.3, r: 0.2, g: 0.2, b: 0.2 } },
      { ...member(1, 0.6), sample: { luma: 0.6, busy: 0.8, lo: 0.4, hi: 0.9, r: 0.6, g: 0.6, b: 0.6 } },
    ])?.plane as GroupPlane;
    // Пестрота и края — самые тяжёлые в блоке, цвет — средний по участникам.
    expect(mixed.rest[0]).toBe(0.8);
    expect(mixed.rest[1]).toBe(0.1);
    expect(mixed.rest[2]).toBe(0.9);
    expect(mixed.rest[3]).toBeCloseTo(0.4, 5);
  });
});

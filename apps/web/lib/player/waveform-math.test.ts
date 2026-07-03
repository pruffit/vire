import { describe, it, expect } from 'vitest';
import { buildBars, ratioFromX } from './waveform-math';

describe('buildBars', () => {
  it('усредняет пики по слайсам, когда пиков больше баров', () => {
    // 4 пика → 2 бара: [1,3]→2, [5,7]→6
    expect(buildBars([1, 3, 5, 7], 2)).toEqual([2, 6]);
  });

  it('пиков меньше баров — растягивает (несколько баров могут указывать на один пик)', () => {
    const bars = buildBars([1, 2], 4);
    expect(bars).toHaveLength(4);
    expect(bars.every((b) => typeof b === 'number')).toBe(true);
  });

  it('пиков ровно столько же, сколько баров — один в один', () => {
    expect(buildBars([0.1, 0.5, 0.9], 3)).toEqual([0.1, 0.5, 0.9]);
  });

  it('barCount <= 0 → пустой массив', () => {
    expect(buildBars([1, 2, 3], 0)).toEqual([]);
    expect(buildBars([1, 2, 3], -1)).toEqual([]);
  });

  it('peaks=null → детерминированная псевдо-волна нужной длины', () => {
    const a = buildBars(null, 8);
    const b = buildBars(null, 8);
    expect(a).toHaveLength(8);
    expect(a).toEqual(b);
    expect(a.every((v) => v >= 0.3 - 1e-9 && v <= 0.7 + 1e-9)).toBe(true);
  });

  it('peaks=[] (пустой массив) — тоже псевдо-волна, не NaN', () => {
    const bars = buildBars([], 5);
    expect(bars).toHaveLength(5);
    expect(bars.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe('ratioFromX', () => {
  const rect = { left: 100, width: 200 };

  it('на левом крае → 0', () => {
    expect(ratioFromX(100, rect)).toBe(0);
  });

  it('на правом крае → 1', () => {
    expect(ratioFromX(300, rect)).toBe(1);
  });

  it('в середине → 0.5', () => {
    expect(ratioFromX(200, rect)).toBe(0.5);
  });

  it('левее прямоугольника — клампится в 0', () => {
    expect(ratioFromX(0, rect)).toBe(0);
  });

  it('правее прямоугольника — клампится в 1', () => {
    expect(ratioFromX(1000, rect)).toBe(1);
  });

  it('нулевая ширина — не делит на 0, возвращает 0', () => {
    expect(ratioFromX(150, { left: 100, width: 0 })).toBe(0);
  });
});

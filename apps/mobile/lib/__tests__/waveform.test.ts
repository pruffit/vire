import { describe, it, expect } from 'vitest';
import { resamplePeaks } from '../playback/waveform-peaks';

describe('resamplePeaks', () => {
  it('сводит произвольное число пиков к фиксированному числу столбиков', () => {
    expect(resamplePeaks(new Array(1000).fill(0.5), 56)).toHaveLength(56);
    expect(resamplePeaks([1, 2, 3], 56)).toHaveLength(56);
  });

  // Трек без посчитанных пиков — не повод ломать скраббер.
  it('без пиков возвращает ровную полосу, а не пустоту', () => {
    const flat = resamplePeaks(null, 10);
    expect(flat).toHaveLength(10);
    expect(new Set(flat).size).toBe(1);
    expect(flat[0]).toBeGreaterThan(0);
  });

  it('пустой массив пиков ведёт себя как отсутствие пиков', () => {
    expect(resamplePeaks([], 8)).toEqual(resamplePeaks(null, 8));
  });

  it('нормирует по максимуму — громкий трек не упирается в потолок, тихий виден', () => {
    const loud = resamplePeaks([100, 50, 100], 3);
    const quiet = resamplePeaks([1, 0.5, 1], 3);
    expect(Math.max(...loud)).toBeCloseTo(1, 5);
    expect(Math.max(...quiet)).toBeCloseTo(1, 5);
  });

  it('все значения в диапазоне от минимума до единицы', () => {
    for (const v of resamplePeaks([0, 0.2, 0.9, 0.4, 1, 0], 20)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('берёт пик по модулю — отрицательные амплитуды не съедают столбик', () => {
    const out = resamplePeaks([-1, -0.9], 2);
    expect(Math.max(...out)).toBeCloseTo(1, 5);
  });

  it('пиков меньше, чем столбиков — полоса всё равно полной длины', () => {
    expect(resamplePeaks([1, 0.5], 32)).toHaveLength(32);
  });
});

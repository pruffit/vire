import { describe, it, expect } from 'vitest';
import { distributeSurplus } from '../design/stack';

describe('distributeSurplus', () => {
  it('делит излишек пропорционально макетным величинам зазоров', () => {
    const [big, small] = distributeSurplus([44, 22], 30);
    expect(big).toBeCloseTo(20);
    expect(small).toBeCloseTo(10);
    expect(big).toBeCloseTo(small * 2);
  });

  it('сумма долей равна всему излишку — он не теряется и не удваивается', () => {
    const gaps = [100, 36, 24, 42, 38, 44];
    const shares = distributeSurplus(gaps, 123);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(123);
  });

  it('отрицательный излишек (низкий аппарат) не раздаётся — там работает прежнее сжатие', () => {
    expect(distributeSurplus([44, 22, 10], -50)).toEqual([0, 0, 0]);
  });

  it('нулевой излишек — нулевые доли', () => {
    expect(distributeSurplus([44, 22], 0)).toEqual([0, 0]);
  });

  it('нулевой суммарный вес не делит на ноль', () => {
    expect(distributeSurplus([0, 0], 100)).toEqual([0, 0]);
  });
});

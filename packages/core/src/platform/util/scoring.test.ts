import { describe, it, expect } from 'vitest';
import { saturateLinear, saturateLog } from './scoring';

describe('saturateLinear', () => {
  it('0 → 0', () => {
    expect(saturateLinear(0, 5)).toBe(0);
  });

  it('отрицательный вход клэмпится к 0', () => {
    expect(saturateLinear(-10, 5)).toBe(0);
  });

  it('n = k достигает ровно 1 (точка насыщения)', () => {
    expect(saturateLinear(5, 5)).toBe(1);
  });

  it('n > k тоже даёт 1, не больше', () => {
    expect(saturateLinear(50, 5)).toBe(1);
    expect(saturateLinear(1_000_000, 5)).toBe(1);
  });

  it('монотонно неубывающая между 0 и k', () => {
    const xs = [0, 1, 2, 3, 4, 5];
    const ys = xs.map((n) => saturateLinear(n, 5));
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThanOrEqual(ys[i - 1]!);
  });

  it('промежуточная точка — линейная доля', () => {
    expect(saturateLinear(3, 3)).toBe(1);
    expect(saturateLinear(1, 3)).toBeCloseTo(1 / 3);
  });
});

describe('saturateLog', () => {
  it('0 и отрицательный вход → 0', () => {
    expect(saturateLog(0, 100)).toBe(0);
    expect(saturateLog(-5, 100)).toBe(0);
  });

  it('очень большое n → близко к 1, но не превышает 1', () => {
    const y = saturateLog(1_000_000_000, 100);
    expect(y).toBeLessThan(1);
    expect(y).toBeGreaterThan(0.9);
  });

  it('монотонно возрастающая (нет потолка на конечных n)', () => {
    const xs = [1, 10, 100, 1_000, 10_000];
    const ys = xs.map((n) => saturateLog(n, 100));
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
  });

  it('n = k — не особая точка, но задаёт масштаб (проверка формулы)', () => {
    expect(saturateLog(100, 100)).toBeCloseTo(Math.log1p(100) / Math.log1p(200));
  });
});

import { describe, expect, it } from 'vitest';
import { applyAccessibility, NO_ACCESSIBILITY } from '../accessibility';
import { resolveOptics } from '../material';

const optics = resolveOptics();

describe('модификаторы доступности', () => {
  it('без настроек оптика остаётся той же', () => {
    expect(applyAccessibility(optics, NO_ACCESSIBILITY)).toEqual(optics);
    expect(applyAccessibility(optics)).toEqual(optics);
  });

  // Движение — не оптика: его считает тот, кто его и рисует.
  it('уменьшение движения оптику не трогает', () => {
    expect(applyAccessibility(optics, { ...NO_ACCESSIBILITY, reduceMotion: true })).toEqual(optics);
  });

  it('уменьшенная прозрачность делает стекло матовее и глуше', () => {
    const out = applyAccessibility(optics, { ...NO_ACCESSIBILITY, reduceTransparency: true });
    expect(out.blur).toBeGreaterThan(optics.blur);
    expect(out.bodyDensity).toBeGreaterThan(optics.bodyDensity);
  });

  it('увеличенный контраст берёт деталь границей, а не одной заливкой', () => {
    const out = applyAccessibility(optics, { ...NO_ACCESSIBILITY, increaseContrast: true });
    expect(out.presence).toBeGreaterThan(optics.presence);
    expect(out.bodyDensity).toBeGreaterThan(optics.bodyDensity);
    expect(out.legibility).toBe(1);
  });

  // Настройки складываются: включены обе — материал обязан выполнить оба требования.
  it('настройки не отменяют друг друга', () => {
    const both = applyAccessibility(optics, {
      reduceTransparency: true,
      increaseContrast: true,
      reduceMotion: true,
    });
    expect(both.blur).toBeGreaterThan(optics.blur);
    expect(both.presence).toBeGreaterThan(optics.presence);
  });
});

import { describe, expect, it } from 'vitest';
import { shadowOpacity, shadowOpacityFrom } from '../geometry';

describe('плотность тени по контенту под деталью', () => {
  // 219 @11:47: над ровным светлым тень СЛАБЕЕ, над текстом ПЛОТНЕЕ.
  it('над ровным фоном тень самая слабая', () => {
    expect(shadowOpacity(0)).toBeCloseTo(0.8, 6);
    expect(shadowOpacity(-1)).toBe(shadowOpacity(0));
  });

  it('пестрота под деталью поднимает тень', () => {
    let prev = -Infinity;
    for (const busy of [0, 0.02, 0.05, 0.1, 0.2, 0.5, 1]) {
      const k = shadowOpacity(busy);
      expect(k).toBeGreaterThanOrEqual(prev);
      prev = k;
    }
    expect(shadowOpacity(0.3)).toBeGreaterThan(shadowOpacity(0));
  });

  // Потолок нужен: без него на границе чёрного и белого тень уходит в чёрную дыру.
  it('рост упирается в потолок', () => {
    expect(shadowOpacity(0.2)).toBeCloseTo(2, 6);
    expect(shadowOpacity(1)).toBeCloseTo(2, 6);
  });

  // Огрубление — только для платформ, где замер идёт через состояние; закон тот же.
  it('огрублённый вариант не уходит от точного дальше шага', () => {
    for (const busy of [0, 0.03, 0.07, 0.11, 0.19, 0.4]) {
      expect(Math.abs(shadowOpacityFrom({ busy }) - shadowOpacity(busy))).toBeLessThanOrEqual(0.025);
    }
  });
});

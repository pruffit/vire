import { describe, expect, it } from 'vitest';

import { REFERENCE_BANDS, REFERENCE_SCENE_HEIGHT, REFERENCE_SHAPES, refGray } from '../reference-scene';

/** Самая тесная площадка: зона мобильной лаборатории — 0.42 высоты экрана, а самый низкий
 *  экран, на котором стенд вообще запускают, — 600 dp. */
const TIGHTEST_STAGE_DP = Math.round(600 * 0.42);

describe('сверочная сцена', () => {
  it('полотно влезает в самую тесную площадку целиком', () => {
    expect(REFERENCE_SCENE_HEIGHT).toBeLessThanOrEqual(TIGHTEST_STAGE_DP);
  });

  // Доли высоты выглядели общими, а были разными: вьюпорт против зоны в 0.42 экрана. Полосы
  // выходили разной толщины, и одна и та же деталь ложилась на разное число полос.
  it('толщина полос задана в dp, а не долей площадки', () => {
    for (const band of REFERENCE_BANDS) {
      expect(band.heightDp).toBeGreaterThanOrEqual(8);
      expect(Number.isInteger(band.heightDp)).toBe(true);
    }
  });

  it('самая крупная фигура умещается в полотно по высоте', () => {
    const tallest = Math.max(...Object.values(REFERENCE_SHAPES).map((g) => g.height));
    expect(tallest).toBeLessThan(REFERENCE_SCENE_HEIGHT);
  });

  it('уровень переводится в серый одинаково на обеих платформах', () => {
    expect(refGray(0)).toBe('#000000');
    expect(refGray(1)).toBe('#ffffff');
    expect(refGray(0.5)).toBe('#808080');
  });
});

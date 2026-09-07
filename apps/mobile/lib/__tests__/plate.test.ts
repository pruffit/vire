import { describe, it, expect } from 'vitest';
import { hitPlay, MOCK_PLATE, plateLeft, playCenterX, type PlateLayout } from '../design/plate';
import { mockScale, scaleMaterial, MOCK_WIDTH } from '../design/mock';

/** Плашка на экране 411 dp: те же числа, что считает мини-плеер. */
const k = mockScale(411);
const at = (v: number) => Math.round(v * k);
const LAYOUT: PlateLayout = {
  plateW: 411 - at(MOCK_PLATE.screenMargin) * 2,
  pad: at(MOCK_PLATE.inset),
  cover: Math.round(48 * k) - at(MOCK_PLATE.inset) * 2,
  coverRadius: at(MOCK_PLATE.coverRadius),
  textGap: at(MOCK_PLATE.textGap),
  play: at(MOCK_PLATE.play),
  titleBaseline: at(MOCK_PLATE.titleBaseline),
  artistBaseline: at(MOCK_PLATE.artistBaseline),
};

describe('раскладка мини-плеера', () => {
  // Коробка маски шире детали на запас деформации, а краска обязана лечь в координатах
  // ДЕТАЛИ: иначе название и обложка уезжают на величину запаса.
  it('краска считается от левого края плашки, а не коробки', () => {
    expect(plateLeft(LAYOUT.plateW, LAYOUT.plateW)).toBe(0);
    expect(plateLeft(LAYOUT.plateW + 40, LAYOUT.plateW)).toBe(20);
  });

  it('значок плей стоит у правого края, а не по центру', () => {
    const x = playCenterX(LAYOUT);
    expect(x).toBeGreaterThan(LAYOUT.plateW * 0.8);
    expect(x + LAYOUT.play / 2).toBeLessThanOrEqual(LAYOUT.plateW - LAYOUT.pad);
  });

  // Плашка одна, а действий на ней два: по значку — плей/пауза, мимо — фуллскрин.
  // Ошибка в координатах тихо превращает одно в другое.
  it('тап по значку — плей, тап по названию и по обложке — нет', () => {
    const middle = LAYOUT.cover / 2 + LAYOUT.pad;
    expect(hitPlay(LAYOUT, { x: playCenterX(LAYOUT), y: middle })).toBe(true);
    expect(hitPlay(LAYOUT, { x: LAYOUT.plateW / 2, y: middle })).toBe(false);
    expect(hitPlay(LAYOUT, { x: LAYOUT.pad + LAYOUT.cover / 2, y: middle })).toBe(false);
  });

  it('зона значка не выходит за плашку ни вправо, ни по высоте', () => {
    const middle = LAYOUT.cover / 2 + LAYOUT.pad;
    const hit = (LAYOUT.play * MOCK_PLATE.playHit) / MOCK_PLATE.play;
    expect(playCenterX(LAYOUT) + hit).toBeLessThanOrEqual(LAYOUT.plateW);
    expect(middle - hit).toBeGreaterThanOrEqual(0);
  });
});

describe('масштаб макета', () => {
  // Макет нарисован на экране шириной 300: перенос сырыми числами даёт композицию мельче
  // при формально совпадающих числах.
  it('на ширине макета масштаб единичный, шире — больше', () => {
    expect(mockScale(MOCK_WIDTH)).toBe(1);
    expect(mockScale(411)).toBeGreaterThan(1);
  });

  // Деталь, выросшая с прежней фаской, отдаёт кромке меньшую долю полуразмера, и та
  // читается тоньше нарисованной. Плёнка не масштабируется: это нанометры, а не раскладка.
  it('толщина и фаска едут вместе с геометрией, плёнка — нет', () => {
    const m = { thickness: 16, bevel: 8, film: 340 };
    const s = scaleMaterial(m, 2);
    expect(s.thickness).toBe(32);
    expect(s.bevel).toBe(16);
    expect(s.film).toBe(340);
  });
});

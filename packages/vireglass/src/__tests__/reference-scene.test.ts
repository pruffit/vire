import { describe, expect, it } from 'vitest';

import {
  REFERENCE_SCENES,
  REFERENCE_SCENE_HEIGHT,
  REFERENCE_SCENE_WIDTH,
  REFERENCE_SHAPES,
  refCheckerCells,
  refGradientSteps,
  refGray,
  referenceScene,
} from '../reference-scene';

/**
 * Самая тесная площадка: зона мобильной лаборатории — 0.42 высоты экрана, а самый низкий экран,
 * на котором стенд вообще запускают, — 600 dp; самый узкий — 360 dp.
 *
 * Числа продублированы намеренно: пакет не может импортировать из `apps/mobile` — слои идут в
 * обратную сторону. Настоящую сторожевую проверку держит сама лаборатория
 * (`apps/mobile/lib/__tests__/material-lab-zone.test.ts`): там высота зоны считается той же
 * формулой, что в продукте, и сверяется с высотой полотна.
 */
const TIGHTEST_STAGE_H = Math.round(600 * 0.42);
const TIGHTEST_STAGE_W = 360;

describe('сверочные полотна', () => {
  it('полотно влезает в самую тесную площадку целиком', () => {
    expect(REFERENCE_SCENE_HEIGHT).toBeLessThanOrEqual(TIGHTEST_STAGE_H);
    expect(REFERENCE_SCENE_WIDTH).toBeLessThan(TIGHTEST_STAGE_W);
  });

  // Полотна лежат друг под другом одной площадкой: разошлись высоты — разошлась и парковка
  // детали, а с ней и весь профиль.
  it('каждое полотно набирает ровно высоту площадки', () => {
    for (const scene of REFERENCE_SCENES) {
      const sum = scene.bands(scene.level).reduce((acc, b) => acc + b.heightDp, 0);
      expect(`${scene.name}: ${sum}`).toBe(`${scene.name}: ${REFERENCE_SCENE_HEIGHT}`);
    }
  });

  it('набор покрывает обещания материала и у каждого полотна сказано, что оно проверяет', () => {
    expect(REFERENCE_SCENES.length).toBeGreaterThanOrEqual(6);
    for (const scene of REFERENCE_SCENES) {
      expect(scene.what.length).toBeGreaterThan(20);
    }
    for (const required of ['ровное', 'полосы', 'пёстрое', 'черта', 'ступени']) {
      expect(() => referenceScene(required)).not.toThrow();
    }
  });

  it('имена полотен не повторяются — по ним стенды выбирают зону', () => {
    const names = REFERENCE_SCENES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('самая крупная фигура умещается в полотно', () => {
    const shapes = Object.values(REFERENCE_SHAPES);
    expect(Math.max(...shapes.map((g) => g.height))).toBeLessThan(REFERENCE_SCENE_HEIGHT);
    expect(Math.max(...shapes.map((g) => g.width))).toBeLessThan(REFERENCE_SCENE_WIDTH);
  });

  // Обе платформы строят расстановку клеток одним генератором: Math.random дал бы разные
  // полотна, а тогда снимки снова несравнимы.
  it('шахматка раскладывается одинаково при одном входе', () => {
    const layer = referenceScene('пёстрое').bands(0.5)[0].layer;
    if (layer.kind !== 'шахматка') throw new Error('полотно «пёстрое» обязано быть шахматкой');
    const a = refCheckerCells(layer, REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT);
    const b = refCheckerCells(layer, REFERENCE_SCENE_WIDTH, REFERENCE_SCENE_HEIGHT);
    expect(a.length).toBe(Math.ceil(REFERENCE_SCENE_WIDTH / layer.cellDp) * Math.ceil(REFERENCE_SCENE_HEIGHT / layer.cellDp));
    expect(b).toEqual(a);
  });

  it('градиент идёт от края до края', () => {
    const layer = referenceScene('градиент').bands(0.5)[0].layer;
    if (layer.kind !== 'градиент') throw new Error('полотно «градиент» обязано быть градиентом');
    const steps = refGradientSteps(layer);
    expect(steps).toHaveLength(layer.steps);
    expect(steps[0]).toBeCloseTo(layer.from);
    expect(steps[steps.length - 1]).toBeCloseTo(layer.to);
  });

  it('уровень переводится в серый одинаково на обеих платформах', () => {
    expect(refGray(0)).toBe('#000000');
    expect(refGray(1)).toBe('#ffffff');
    expect(refGray(0.5)).toBe('#808080');
  });
});

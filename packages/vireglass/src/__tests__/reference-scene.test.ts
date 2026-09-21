import { describe, expect, it } from 'vitest';

import {
  REFERENCE_SCENES,
  REFERENCE_SCENE_HEIGHT,
  REFERENCE_SCENE_WIDTH,
  REFERENCE_SHAPES,
  refCheckerCells,
  refGradientSteps,
  refGray,
  refGridPositions,
  refStripePositions,
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

  // Позиции полос — тот же список у канваса и у вьюх (`refStripePositions`); проверяется здесь
  // одна арифметика на обе платформы.
  it('полосы стоят с постоянным шагом и не вылезают за полотно', () => {
    const layer = referenceScene('полосы').bands(0.5)[0].layer;
    if (layer.kind !== 'полосы') throw new Error('полотно «полосы» обязано быть полосами');
    const positions = refStripePositions(layer, REFERENCE_SCENE_WIDTH);
    expect(positions.length).toBe(Math.ceil(REFERENCE_SCENE_WIDTH / layer.periodDp));
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i] - positions[i - 1]).toBe(layer.periodDp);
    }
    expect(positions[0]).toBe(0);
    expect(positions[positions.length - 1] + layer.widthDp).toBeLessThanOrEqual(REFERENCE_SCENE_WIDTH);
  });

  it('на узкой ширине полос не бывает вовсе — цикл не спотыкается о пустой диапазон', () => {
    const layer = referenceScene('полосы').bands(0.5)[0].layer;
    if (layer.kind !== 'полосы') throw new Error('полотно «полосы» обязано быть полосами');
    expect(refStripePositions(layer, 0)).toEqual([]);
  });

  // Позиции линий сетки — тот же список у канваса и у вьюх (`refGridPositions`); дальний край
  // включён нарочно, иначе платформа, у которой край совпал с шагом, теряет последнюю линию.
  it('линии сетки идут с постоянным шагом и включают оба края', () => {
    const layer = referenceScene('сетка').bands(0.5)[0].layer;
    if (layer.kind !== 'сетка') throw new Error('полотно «сетка» обязано быть сеткой');
    const vertical = refGridPositions(layer.stepDp, REFERENCE_SCENE_WIDTH);
    const horizontal = refGridPositions(layer.stepDp, REFERENCE_SCENE_HEIGHT);
    expect(vertical[0]).toBe(0);
    expect(vertical[vertical.length - 1]).toBe(REFERENCE_SCENE_WIDTH);
    expect(horizontal[0]).toBe(0);
    expect(horizontal[horizontal.length - 1]).toBe(REFERENCE_SCENE_HEIGHT);
    for (let i = 1; i < vertical.length; i += 1) {
      expect(vertical[i] - vertical[i - 1]).toBe(layer.stepDp);
    }
  });

  // «Сетка» — периодическая структура: пометка сама по себе тестируется явно, чтобы кто-нибудь
  // не снял её с полотна незаметно и не вернул полотно в числовые гейты.
  it('полотно «сетка» помечено как неметрическое, остальные — нет', () => {
    expect(referenceScene('сетка').measurable).toBe(false);
    for (const scene of REFERENCE_SCENES) {
      if (scene.name === 'сетка') continue;
      expect(scene.measurable).not.toBe(false);
    }
  });
});

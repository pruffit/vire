import { describe, expect, it } from 'vitest';

import { REFERENCE_SCENE_HEIGHT, REFERENCE_SCENE_WIDTH } from '../vireglass/material';

/** Та же формула, что задаёт высоту зоны стенда (`material-lab-scene.tsx`). Держать её здесь
 *  приходится потому, что модуль стенда тянет за собой React Native целиком. */
const zoneHeight = (screenHeightDp: number) => Math.round(screenHeightDp * 0.42);

/** Самый низкий и самый узкий экран, на котором лабораторию вообще запускают. */
const SMALLEST_SCREEN_H = 600;
const SMALLEST_SCREEN_W = 360;

describe('зона стенда вмещает сверочное полотно', () => {
  // Полотно рисуется панелью фиксированного размера в dp, и если зона окажется ниже, нижние
  // полосы увидит только веб-стенд — сверка платформ тогда молча меряет разные картинки.
  it('на самом низком экране полотно влезает целиком', () => {
    expect(zoneHeight(SMALLEST_SCREEN_H)).toBeGreaterThanOrEqual(REFERENCE_SCENE_HEIGHT);
  });

  it('на самом узком экране полотно влезает по ширине с полем окружения', () => {
    expect(SMALLEST_SCREEN_W).toBeGreaterThan(REFERENCE_SCENE_WIDTH);
  });
});

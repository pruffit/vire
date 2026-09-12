import { describe, expect, it } from 'vitest';
import { SCROLL_EDGE_ENGAGE_DP } from '@vire/vireglass';
import { edgeStrength, scrimColors, SCRIM_DIM, SCRIM_DISSOLVE, SCRIM_STOPS } from '../design/scroll-edge';

const SCREEN = 800;

describe('сила краевого эффекта', () => {
  // Первый кадр экрана: габаритов ещё нет, и мигнуть чистым фоном хуже, чем приглушить зря.
  it('до замера — полная', () => {
    expect(edgeStrength(0, 0, 0)).toBe(1);
    expect(edgeStrength(0, 1200, 0)).toBe(1);
  });

  // Экран измерен, а контента нет — это не то же самое, что «ещё не измерено».
  it('измеренная пустота эффекта не даёт', () => {
    expect(edgeStrength(0, 0, SCREEN)).toBe(0);
  });

  it('короткому списку эффект не нужен: под мебелью пусто', () => {
    expect(edgeStrength(0, SCREEN, SCREEN)).toBe(0);
    expect(edgeStrength(0, SCREEN - 200, SCREEN)).toBe(0);
  });

  it('пока списку есть куда ехать — полная', () => {
    expect(edgeStrength(0, 4000, SCREEN)).toBe(1);
    expect(edgeStrength(1500, 4000, SCREEN)).toBe(1);
  });

  it('на последних дюймах сходит на нет', () => {
    const max = 4000 - SCREEN;
    expect(edgeStrength(max, 4000, SCREEN)).toBe(0);
    expect(edgeStrength(max - SCROLL_EDGE_ENGAGE_DP / 2, 4000, SCREEN)).toBeCloseTo(0.5, 5);
    expect(edgeStrength(max - SCROLL_EDGE_ENGAGE_DP, 4000, SCREEN)).toBe(1);
  });

  // Перетяг за конец списка (bounce) уводит прокрутку за максимум — сила обязана остаться в шкале.
  it('перетяг за край не уводит силу ниже нуля', () => {
    expect(edgeStrength(4000, 4000, SCREEN)).toBe(0);
  });
});

describe('чем красится край', () => {
  // Под тёмным стеклом контент гасит само стекло, экрану остаётся меньше (эталон §10).
  it('тёмный стиль стекла — лёгкое затемнение, светлый — растворение в фон', () => {
    expect(scrimColors('dim')).toBe(SCRIM_DIM);
    expect(scrimColors('dissolve')).toBe(SCRIM_DISSOLVE);
  });

  it('затемнение легче растворения', () => {
    const alpha = (color: string) => Number(color.slice(color.lastIndexOf(',') + 1, -1));
    expect(alpha(SCRIM_DIM[2])).toBeLessThan(alpha(SCRIM_DISSOLVE[2]));
  });

  it('стопы совпадают с числом цветов', () => {
    expect(scrimColors('dissolve')).toHaveLength(SCRIM_STOPS.length);
    expect(scrimColors('hard')).toHaveLength(SCRIM_STOPS.length);
  });

  // Жёсткий стиль — ровная полоса: градиента в нём нет по определению.
  it('жёсткий стиль идёт без градиента', () => {
    const hard = scrimColors('hard');
    expect(new Set(hard).size).toBe(1);
  });
});

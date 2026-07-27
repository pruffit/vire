import { describe, expect, it } from 'vitest';
import { clampPanelX } from '../clamp-panel-x';

describe('clampPanelX', () => {
  it('влезает — сдвиг не нужен', () => {
    expect(clampPanelX({ panelLeft: 50, panelWidth: 200, viewportWidth: 390, margin: 8 })).toBe(0);
  });

  it('вылезает вправо — сдвигает влево до поля', () => {
    const offset = clampPanelX({ panelLeft: 300, panelWidth: 320, viewportWidth: 390, margin: 8 });
    expect(offset).toBe(-238);
    expect(300 + offset + 320).toBe(390 - 8);
  });

  it('вылезает влево — сдвигает вправо до поля', () => {
    const offset = clampPanelX({ panelLeft: -41.5, panelWidth: 320, viewportWidth: 390, margin: 8 });
    expect(offset).toBe(49.5);
    expect(-41.5 + offset).toBe(8);
  });

  it('панель шире вьюпорта — прижимает к левому полю', () => {
    const offset = clampPanelX({ panelLeft: 20, panelWidth: 400, viewportWidth: 390, margin: 8 });
    expect(offset).toBe(-12);
    expect(20 + offset).toBe(8);
  });
});

import { describe, expect, it } from 'vitest';
import { applyAccessibility, NO_ACCESSIBILITY } from '../accessibility';
import { applyGlassScale, GLASS_SCALE_DEFAULT } from '../glass-scale';
import { resolveOptics, VIREGLASS_CLEAR_MATERIAL, VIREGLASS_MATERIAL } from '../material';

const base = resolveOptics(VIREGLASS_MATERIAL);

describe('пользовательская шкала прозрачности', () => {
  // Главное обещание шкалы: её появление ничего не двигает, пока пользователь её не двинул.
  it('в точке по умолчанию оптика не меняется вовсе', () => {
    expect(applyGlassScale(base, GLASS_SCALE_DEFAULT)).toEqual(base);
    const clear = resolveOptics(VIREGLASS_CLEAR_MATERIAL);
    expect(applyGlassScale(clear, GLASS_SCALE_DEFAULT)).toEqual(clear);
  });

  it('к прозрачному концу требование читаемости и затемнение отпускаются', () => {
    const ultra = applyGlassScale(base, 0);
    expect(ultra.legibility).toBe(0);
    expect(applyGlassScale(resolveOptics(VIREGLASS_CLEAR_MATERIAL), 0).dimming).toBe(0);
  });

  it('к тонированному концу тело закрывает содержимое', () => {
    expect(applyGlassScale(base, 1).bodyDensity).toBeGreaterThan(0.8);
  });

  it('ход монотонный по всей шкале', () => {
    let prevLeg = -Infinity;
    let prevBody = -Infinity;
    for (let s = 0; s <= 1.0001; s += 0.05) {
      const o = applyGlassScale(base, s);
      expect(o.legibility).toBeGreaterThanOrEqual(prevLeg);
      expect(o.bodyDensity).toBeGreaterThanOrEqual(prevBody);
      prevLeg = o.legibility;
      prevBody = o.bodyDensity;
    }
  });

  it('за края шкалы не выходит', () => {
    expect(applyGlassScale(base, -3)).toEqual(applyGlassScale(base, 0));
    expect(applyGlassScale(base, 7)).toEqual(applyGlassScale(base, 1));
  });

  // Эталон: настройки системы главнее и вида материала, и пользовательской чистоты.
  it('доступность поверх шкалы возвращает читаемость', () => {
    const ultra = applyGlassScale(base, 0);
    const out = applyAccessibility(ultra, { ...NO_ACCESSIBILITY, increaseContrast: true });
    expect(out.legibility).toBe(1);
    expect(out.bodyDensity).toBeGreaterThanOrEqual(0.9);
  });
});

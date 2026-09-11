import { describe, expect, it } from 'vitest';
import { FLIP_LUMA, INK_DARK, INK_LIGHT, RETURN_LUMA, shouldInkBeLight } from '../adaptation';
import { LENS_SHADER } from '../lens-shader';
import { colorPickup, diffraction, dispersion, iridescence } from '../optics';
import { resolveOptics } from '../material';

describe('спектральная оптика', () => {
  it('без плёнки интерференции нет вовсе', () => {
    expect(iridescence(1.5, 0)).toBe(0);
    expect(iridescence(1.5, 400)).toBeGreaterThan(0);
  });

  it('переливы ярче у плотной среды — они живут в отражении', () => {
    expect(iridescence(1.7, 400)).toBeGreaterThan(iridescence(1.2, 400));
  });

  it('дифракция и дисперсия растут вместе: причина у них одна', () => {
    expect(diffraction(1.7)).toBeGreaterThan(diffraction(1.3));
    expect(diffraction(1.7)).toBeLessThan(dispersion(1.7));
  });

  it('подхват цвета ограничен сверху — тинт обязан остаться средой, а не заливкой', () => {
    expect(colorPickup(2)).toBeLessThanOrEqual(0.42);
    expect(colorPickup(1)).toBe(0);
  });

  it('дефолт продукта несёт плёнку и, значит, переливы', () => {
    const o = resolveOptics();
    expect(o.film).toBeGreaterThan(0);
    expect(o.iridescence).toBeGreaterThan(0);
  });
});

describe('тело стекла в шейдере', () => {
  // Подсветка окружения обязана быть одинаковой по всей детали. Пока она шла множителем
  // mix(0.35, 1.0, t), середина светилась втрое слабее кромки — и это читалось пятном
  // другого тона по центру стекла.
  it('подсветка тела не зависит от места на детали', () => {
    expect(LENS_SHADER).toContain('rgb += ambient * u_edgeLight * (0.05 + 0.2 * (1.0 - local)) * u_appear;');
  });
});

describe('предел стекла и полярность', () => {
  // Правило эталона (reference.md §3): над жёлтым цветком глифы уже чёрные, а стекло светлое.
  it('над светлым цветом надпись уходит в тёмную', () => {
    expect(shouldInkBeLight({ luma: 0.78 }, true)).toBe(false);
    expect(shouldInkBeLight({ luma: 0.95 }, true)).toBe(false);
  });

  it('на насыщенном и тёмном фоне надпись остаётся светлой', () => {
    for (const l of [0.05, 0.35, 0.5, 0.58]) expect(shouldInkBeLight({ luma: l }, true)).toBe(true);
  });

  // Зазор между «переключиться» и «вернуться» — иначе надпись мигает на каждой светлой
  // обложке, проехавшей под краем стекла.
  it('возврат к светлой требует заметно более тёмного фона, чем уход от неё', () => {
    const between = (FLIP_LUMA + RETURN_LUMA) / 2;
    expect(shouldInkBeLight({ luma: between }, true)).toBe(true);
    expect(shouldInkBeLight({ luma: between }, false)).toBe(false);
    expect(FLIP_LUMA - RETURN_LUMA).toBeGreaterThanOrEqual(0.1);
  });

  it('решение уклоняется к самому светлому месту под стеклом', () => {
    expect(shouldInkBeLight({ luma: 0.55 }, true)).toBe(true);
    expect(shouldInkBeLight({ luma: 0.55, hi: 0.95 }, true)).toBe(false);
  });

  it('надпись описывается двумя концами шкалы, а не произвольной светлотой', () => {
    expect(INK_LIGHT).toBeGreaterThan(0.9);
    expect(INK_DARK).toBeLessThan(0.1);
  });
});

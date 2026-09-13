import { describe, expect, it } from 'vitest';
import {
  ambientFrom,
  FLIP_LUMA,
  INK_DARK,
  INK_LIGHT,
  RETURN_LUMA,
  shouldInkBeLight,
} from '../adaptation';
import { LENS_SHADER } from '../lens-shader';
import { SURFACE_SHADER } from '../surface-shader';
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
  // Обе строки, которые трогают светлоту тела, обязаны быть одинаковыми по всей детали. Пока
  // подсветка шла множителем mix(0.35, 1.0, t), середина светилась втрое слабее кромки — и это
  // читалось пятном другого тона по центру стекла.
  it('подсветка тела не зависит от места на детали', () => {
    expect(LENS_SHADER).toContain('rgb = mix(rgb, vgHue(ambient) * VG_MEDIUM_LUMA, VG_MEDIUM_PULL * u_appear);');
    expect(LENS_SHADER).toContain('rgb += ambient * u_edgeLight * VG_AMBIENT_SPILL * u_appear;');
  });

  // Рассеяние ЗАМЕНЯЕТ rgb целиком (вес доходит до единицы), поэтому всё, что легло раньше,
  // теряется. Обратный порядок стирал отражение окружения на всей детали и гейтом не ловился:
  // пороги перекрывали разницу с запасом (issue #106).
  it('отражение ложится ПОСЛЕ рассеяния', () => {
    const scatter = LENS_SHADER.indexOf('rgb = mix(rgb, blurred, smoothstep(0.5, 2.0, adaptBlur));');
    const reflection = LENS_SHADER.indexOf('rgb = mix(rgb, env * spectral, fres);');
    expect(scatter).toBeGreaterThan(-1);
    expect(reflection).toBeGreaterThan(-1);
    expect(reflection).toBeGreaterThan(scatter);
  });

  // Тень обязана быть СЛАБЕЕ у самого контура, чем ниже него: у эталона минимум стоит на
  // 17…25 px ниже кромки. Слагаемые, монотонные по расстоянию от силуэта, такого профиля не
  // дают, а гейт откат не ловит — при возврате контактного затемнения обе его метрики даже
  // растут (предмет 7.1 → 9.7, раздув 1.90 → 1.92).
  it('тень у контура ослаблена зазором', () => {
    expect(SURFACE_SHADER).toContain('mix(VG_GAP_LIGHT, 1.0, gap)');
    expect(SURFACE_SHADER).not.toContain('con * con');
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

describe('цвет окружения для тени', () => {
  // Замер приходит раз в 180 мс, и на мобилке каждая выборка иначе дёргала бы перерисовку.
  it('огрубляется шагом, а не тянется точным значением', () => {
    expect(ambientFrom({ r: 0.501, g: 0.5, b: 0.499 })).toEqual([0.5, 0.5, 0.5]);
  });

  it('зажимается в допустимый диапазон', () => {
    expect(ambientFrom({ r: -1, g: 2, b: 0.25 })).toEqual([0, 1, 0.25]);
  });
});

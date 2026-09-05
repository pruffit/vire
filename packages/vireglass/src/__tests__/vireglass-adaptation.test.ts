import { describe, expect, it } from 'vitest';
import {
  bodyCap,
  bodyDensityFor,
  bodyLuma,
  contrastRatio,
  INK_DARK,
  INK_LIGHT,
  preferredPolarity,
  relativeLuminance,
} from '../vireglass/adaptation';
import { LENS_SHADER } from '../vireglass/lens-shader';
import { colorPickup, diffraction, dispersion, iridescence } from '../vireglass/optics';
import { resolveOptics } from '../vireglass/material';

const LEGIBILITY = 0.26;
const BODY = 0.04;

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

describe('тело стекла: модель в JS и в шейдере', () => {
  // Решение о перекраске считается в JS, а рисует стекло шейдер. Если константы разъедутся,
  // приложение будет судить по одной физике, а пользователь видеть другую — и перекраска
  // включится не там, где надпись действительно тонет.
  it('константы совпадают с шейдером', () => {
    expect(LENS_SHADER).toContain('const float VG_BODY_CAP_LOOSE = 0.62;');
    expect(LENS_SHADER).toContain('const float VG_BODY_CAP_TIGHT = 0.38;');
    expect(LENS_SHADER).toContain('const float VG_TINT_DARK = 0.07;');
    expect(LENS_SHADER).toContain('const float VG_TINT_LIGHT = 0.94;');
    expect(LENS_SHADER).toContain('0.0, 0.92)');
  });

  // Подсветка окружения обязана быть одинаковой по всей детали. Пока она шла множителем
  // mix(0.35, 1.0, t), середина светилась втрое слабее кромки — и это читалось пятном
  // другого тона по центру стекла.
  it('подсветка тела не зависит от места на детали', () => {
    expect(LENS_SHADER).toContain('rgb += ambient * u_edgeLight * (0.12 + 0.55 * (1.0 - local));');
  });

  it('порог читаемости — потолок светлоты, и он строже при высоком требовании', () => {
    expect(bodyCap(0.6)).toBeLessThan(bodyCap(0.1));
    expect(bodyCap(1)).toBeCloseTo(0.38, 5);
  });

  it('над светлым фоном светлая полярность делает тело темнее фона', () => {
    expect(bodyLuma(1, LEGIBILITY, BODY, 1)).toBeLessThan(1);
  });

  it('над тёмным фоном тёмная полярность делает тело светлее фона', () => {
    expect(bodyLuma(0, LEGIBILITY, BODY, 0)).toBeGreaterThan(0);
  });

  it('светлота тела монотонна по светлоте фона', () => {
    let prev = -1;
    for (let l = 0; l <= 1.0001; l += 0.05) {
      const v = bodyLuma(l, LEGIBILITY, BODY, 1);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  // Главный дефект прежней модели: она требовала от тела быть «на sep темнее» надписи, то
  // есть светлее 0.86 — и считала белый текст на насыщенном жёлтом читаемым. Он там не виден.
  it('на насыщенном цвете тело затемняется настолько, что светлая надпись читается', () => {
    const yellow = 0.62;
    expect(contrastRatio(INK_LIGHT, bodyLuma(yellow, LEGIBILITY, BODY, 1))).toBeGreaterThan(3);
  });

  it('светлая надпись читается на любой светлоте фона — ценой плотности', () => {
    for (let l = 0; l <= 1.0001; l += 0.05) {
      expect(contrastRatio(INK_LIGHT, bodyLuma(l, LEGIBILITY, BODY, 1))).toBeGreaterThan(3);
    }
  });
});

describe('предел стекла и полярность', () => {
  it('WCAG: белое на чёрном — 21:1', () => {
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 1);
    expect(relativeLuminance(0)).toBe(0);
  });

  const cost = (l: number) => bodyDensityFor(l, LEGIBILITY, 0, 1);

  // Правило продукта: надпись светлая везде, кроме очень светлого фона. На цветном её
  // вытягивает плотность тела, а не смена цвета — иначе иконки на цветных блоках прыгают
  // из белых в чёрные и обратно.
  it('на цветном фоне стекло справляется само — перекрашивать нечего', () => {
    // 0.78 — светлота насыщенного жёлтого, самого светлого из цветов, на которых надпись
    // обязана остаться белой.
    for (const l of [0.35, 0.5, 0.62, 0.7, 0.78]) {
      expect(cost(l)).toBeLessThan(0.48);
    }
  });

  it('на очень светлом фоне цена удержания светлой надписи выходит за предел', () => {
    expect(cost(0.92)).toBeGreaterThan(0.48);
    expect(cost(1)).toBeGreaterThan(0.48);
  });

  // Зазор между «переключиться» и «вернуться» — иначе надпись мигает на каждой светлой
  // обложке, проехавшей под краем стекла.
  it('возврат к светлой требует заметно более тёмного фона, чем уход от неё', () => {
    const flipAt = [...Array(101).keys()].map((i) => i / 100).find((l) => cost(l) > 0.48) ?? 1;
    const backAt = [...Array(101).keys()].map((i) => i / 100).find((l) => cost(l) > 0.34) ?? 1;
    expect(backAt).toBeLessThan(flipAt);
  });

  it('над границей чёрного и белого решение остаётся за плотностью, а не за цветом', () => {
    expect(cost(0.5 * 0.75 + 1 * 0.25)).toBeLessThan(0.48);
  });

  it('требование читаемости разводит тело с надписью тем сильнее, чем оно выше', () => {
    expect(bodyLuma(0.7, 0.6, BODY, 1)).toBeLessThan(bodyLuma(0.7, 0.1, BODY, 1));
    expect(bodyLuma(0.3, 0.6, BODY, 0)).toBeGreaterThan(bodyLuma(0.3, 0.1, BODY, 0));
  });

  it('под потолком стекло не вмешивается вовсе', () => {
    const under = bodyCap(0.1) - 0.05;
    expect(bodyDensityFor(under, 0.1, 0, 1)).toBe(0);
  });

  it('обе полярности остаются измеримыми — по ним читают отчёт', () => {
    const d = preferredPolarity(0.5, LEGIBILITY, BODY);
    expect(d.light).toBeGreaterThan(0);
    expect(d.dark).toBeGreaterThan(0);
  });

  it('надпись описывается двумя концами шкалы, а не произвольной светлотой', () => {
    expect(INK_LIGHT).toBeGreaterThan(0.9);
    expect(INK_DARK).toBeLessThan(0.1);
  });
});

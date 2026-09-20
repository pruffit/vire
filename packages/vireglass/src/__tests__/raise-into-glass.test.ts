import { describe, expect, it } from 'vitest';
import { raiseIntoGlass } from '../touch-response';

describe('подъём органа в стекло', () => {
  it('в покое орган матовый', () => {
    expect(raiseIntoGlass(0)).toEqual({ glass: 0, solid: 1 });
  });

  it('под полным нажатием остаётся одна линза', () => {
    expect(raiseIntoGlass(1)).toEqual({ glass: 1, solid: 0 });
  });

  // Отрыв от подложки сюда не входит намеренно: `u_lift` шейдера — направление, а величину
  // даёт нажатие, на которое он домножается. Третья доля отсюда означала бы нажатие в квадрате.
  it('долей подъёма не отдаёт — её роль исполняет само нажатие', () => {
    expect(Object.keys(raiseIntoGlass(0.5)).sort()).toEqual(['glass', 'solid']);
  });

  // Ради этого перекрытия доли и разведены по кривым: сложись они в единицу ровно, в середине
  // перехода сквозь ручку на миг просвечивала бы подложка — дырка вместо органа управления.
  it('на всём переходе стекло и матовость перекрываются', () => {
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      const { glass, solid } = raiseIntoGlass(t);
      expect(glass + solid, `нажатие ${t}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('стекло приходит быстрее, чем уходит матовость', () => {
    const { glass, solid } = raiseIntoGlass(0.5);
    expect(glass).toBeGreaterThan(0.5);
    expect(solid).toBeGreaterThan(0.5);
  });

  it('обе доли идут монотонно', () => {
    let glassWas = -1;
    let solidWas = 2;
    for (let i = 0; i <= 20; i += 1) {
      const { glass, solid } = raiseIntoGlass(i / 20);
      expect(glass).toBeGreaterThanOrEqual(glassWas);
      expect(solid).toBeLessThanOrEqual(solidWas);
      glassWas = glass;
      solidWas = solid;
    }
  });

  it('за пределами шкалы зажимается', () => {
    expect(raiseIntoGlass(-1)).toEqual(raiseIntoGlass(0));
    expect(raiseIntoGlass(4)).toEqual(raiseIntoGlass(1));
  });
});

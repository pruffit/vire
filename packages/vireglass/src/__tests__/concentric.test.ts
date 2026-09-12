import { describe, expect, it } from 'vitest';
import { concentricInset, concentricRadius } from '../concentric';

describe('концентричность вложенных форм', () => {
  // Эталон 219 @7:53: вложенные формы делят центр кривизны, поэтому радиус уменьшается ровно
  // на отступ. Иначе углы идут не параллельно и зазор между формами то съедается, то расходится.
  it('радиус внутренней формы меньше внешнего ровно на отступ', () => {
    expect(concentricRadius(34, 12)).toBe(22);
    expect(concentricRadius(26, 8)).toBe(18);
  });

  it('отступ больше внешнего радиуса даёт прямой угол, а не отрицательный радиус', () => {
    expect(concentricRadius(10, 24)).toBe(0);
  });

  it('обратная задача возвращает тот же отступ', () => {
    const outer = 34;
    const inset = 12;
    expect(concentricInset(outer, concentricRadius(outer, inset))).toBe(inset);
  });

  // Вложенность держится на любой глубине: кнопка в плашке, плашка в экране.
  it('вложение складывается по цепочке', () => {
    const screen = 44;
    const plate = concentricRadius(screen, 10);
    const button = concentricRadius(plate, 6);
    expect(plate).toBe(34);
    expect(button).toBe(28);
    expect(concentricRadius(screen, 16)).toBe(button);
  });
});

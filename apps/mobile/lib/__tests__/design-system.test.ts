import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  GLASS_GREEN_MAX,
  GLASS_SURFACES,
  backdropAllowed,
  REACHABLE_SCENARIOS,
  countSurfaces,
} from '../design/glass-budget';
import { space, layout, radii, duration, motionDuration } from '../design/scales';
import { tokens } from '@vire/design-tokens/native';
import { type as typeScale, fonts, MIN_SIZE } from '../design/typography';

describe('бюджет стеклянных поверхностей', () => {
  // Главный инвариант фазы. До P1 он нарушался: поиск + мини-плеер + таб-бар + шит
  // давали 7 поверхностей — ровно точку насыщения по замеру на устройстве.
  it('ни один достижимый сценарий не выходит за зелёную зону', () => {
    for (const [name, elements] of Object.entries(REACHABLE_SCENARIOS)) {
      expect(countSurfaces(elements), `сценарий «${name}»`).toBeLessThanOrEqual(GLASS_GREEN_MAX);
    }
  });

  it('открытый sheet гасит нижние поверхности — иначе поиск с шитом даёт 7', () => {
    const withoutSheet = countSurfaces(['tabBar', 'miniPlayer', 'searchField']);
    const withSheet = countSurfaces(['tabBar', 'miniPlayer', 'searchField', 'sheet']);

    expect(withoutSheet).toBe(6);
    // Без подавления было бы 7. Sheet остаётся единственной живой поверхностью.
    expect(withSheet).toBe(1);
  });

  it('таб-бар из раздельных кругов стоит четыре поверхности, а не одну', () => {
    expect(GLASS_SURFACES.tabBar).toBe(4);
  });

  it('крупная плашка стоит столько же, сколько мелкая — цена в числе, не в площади', () => {
    expect(GLASS_SURFACES.contentPlate).toBe(GLASS_SURFACES.miniPlayer);
  });

  it('экран-оверлей глушит нижние поверхности, но не свою собственную', () => {
    // Плеер сам поднимает счётчик листов. Без оговорки topLayer он выключал живой бэкдроп
    // своему же стеклу, и панель текста падала в непрозрачный фолбэк.
    const withPlayer = { glassEnabled: true, openSheets: 1 };
    expect(backdropAllowed(withPlayer, false)).toBe(false);
    expect(backdropAllowed(withPlayer, true)).toBe(true);
    // Тумблер стекла — аварийный выход и старше всего остального.
    expect(backdropAllowed({ glassEnabled: false, openSheets: 0 }, true)).toBe(false);
  });

  it('пятый таб вернуть можно — бюджет выдерживает', () => {
    // Кит рисует пять кругов (с Сообщениями). Проверяем, что возврат не выбьет за зону.
    const fiveTabs = 5 + GLASS_SURFACES.miniPlayer;
    expect(fiveTabs).toBeLessThanOrEqual(GLASS_GREEN_MAX);
  });
});

describe('шкалы', () => {
  it('шаг сетки кратен четырём — иначе это не шкала, а произвольные числа', () => {
    for (const [name, value] of Object.entries(space)) {
      expect(value % 2, `space.${name}`).toBe(0);
    }
    expect(Object.values(space)).toEqual([...Object.values(space)].sort((a, b) => a - b));
  });

  it('тач-зона не меньше 44 — требование кита и платформы', () => {
    expect(layout.touchTarget).toBeGreaterThanOrEqual(44);
  });

  it('поля списков плотнее полей экрана', () => {
    expect(layout.listPadding).toBeLessThan(layout.screenPadding);
  });

  it('радиусы возрастают от обложки к листу', () => {
    expect(radii.coverSm).toBeLessThan(radii.card);
    expect(radii.card).toBeLessThan(radii.glass);
    expect(radii.glass).toBeLessThan(radii.sheet);
  });

  // «Приглушить движение» обнуляет анимации, а не замедляет: пользователь просил тишины.
  it('reduceMotion обнуляет длительности, а не растягивает', () => {
    for (const key of Object.keys(duration) as (keyof typeof duration)[]) {
      expect(motionDuration(key, true)).toBe(0);
      expect(motionDuration(key, false)).toBe(duration[key]);
    }
  });
});

describe('типографика', () => {
  it('каждый стиль называет семейство, а не вес', () => {
    const families = new Set<string>(Object.values(fonts));
    for (const [name, style] of Object.entries(typeScale)) {
      expect(style.fontFamily, `type.${name} без fontFamily`).toBeDefined();
      expect(families.has(style.fontFamily as string), `type.${name}: чужое семейство`).toBe(true);
      // fontWeight на кастомном шрифте Android не синтезирует надёжно — его быть не должно.
      expect(style, `type.${name} задаёт fontWeight`).not.toHaveProperty('fontWeight');
    }
  });

  it('кегли не опускаются ниже минимумов кита', () => {
    for (const [name, style] of Object.entries(typeScale)) {
      const isMono = (style.fontFamily as string).startsWith('JetBrainsMono');
      const min = isMono ? MIN_SIZE.mono : MIN_SIZE.sans;
      expect(style.fontSize, `type.${name}`).toBeGreaterThanOrEqual(min);
    }
  });

  it('три роли и каждая при своём шрифте', () => {
    // Мета — моноширинный, витрина — плакатный гротеск, интерфейс — Manrope. Витриной нельзя
    // набирать строку списка: плакатное начертание в мелком кегле нечитаемо.
    //
    // Семейство витрины сверяется С ТОКЕНОМ, а не с именем: какое оно — решение общее для
    // веба и Android, и меняться оно должно в одном месте, не ломая тест.
    expect((typeScale.mono.fontFamily as string).startsWith('JetBrainsMono')).toBe(true);
    for (const key of ['screenTitle', 'releaseTitle'] as const) {
      expect(
        (typeScale[key].fontFamily as string).startsWith(tokens.font.display.family),
        key,
      ).toBe(true);
    }
    for (const key of ['row', 'body', 'caption', 'subtitle', 'button'] as const) {
      expect((typeScale[key].fontFamily as string).startsWith('Manrope'), key).toBe(true);
    }
  });

  it('межбуквенное у крупных заголовков отрицательное — кит требует −1…−2 %', () => {
    expect(typeScale.screenTitle.letterSpacing).toBeLessThan(0);
    expect(typeScale.releaseTitle.letterSpacing).toBeLessThan(0);
  });
});

describe('шрифт задаётся семейством, а не весом', () => {
  // Android не синтезирует начертания у кастомных шрифтов: fontWeight на Manrope молча
  // рисует обычный вес. Продукт от этого выглядел «мелким и тонким» — правило было в
  // typography.ts, но проверялось только на самой шкале, а экраны его нарушали в 60+ местах.
  const ROOT = join(__dirname, '..', '..');
  const LABS = /glass-bench|glass-lab|material-lab/;

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (name.endsWith('.tsx')) out.push(p);
    }
    return out;
  };

  it('ни один экран и компонент продукта не задаёт fontWeight', () => {
    const files = [...walk(join(ROOT, 'components')), ...walk(join(ROOT, 'screens'))].filter(
      (f) => !LABS.test(f),
    );
    const guilty = files.filter((f) => readFileSync(f, 'utf8').includes('fontWeight'));
    expect(guilty.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });
});

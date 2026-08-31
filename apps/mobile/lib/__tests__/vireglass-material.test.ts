import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DYNAMIC_UNIFORMS,
  ICON_UNIFORMS,
  toLensProps,
  toSurfaceUniforms,
} from '../vireglass/adapters';
import {
  bevelDp,
  bevelFraction,
  chromaDp,
  circleGeometry,
  edgePushDp,
  halfMinDp,
  lensPadDp,
  MAX_BEVEL_FRACTION,
  roundedRectGeometry,
  surfacePadDp,
} from '../vireglass/geometry';
import { LENS_SHADER } from '../vireglass/lens-shader';
import {
  absorption,
  edgeDensity,
  edgePush,
  fresnelF0,
  refractionStrength,
  specularPower,
} from '../vireglass/optics';
import {
  applyToggles,
  DEBUG_MODES,
  debugIndex,
  LEGACY_NAMES,
  LEGACY_OPTICS,
  MATERIAL_PRESETS,
  MATERIAL_RANGES,
  PRESET_NAMES,
  resolveMaterial,
  resolveOptics,
} from '../vireglass/material';
import { SURFACE_SHADER } from '../vireglass/surface-shader';

const HERE = dirname(fileURLToPath(import.meta.url));
const NATIVE = resolve(HERE, '../../modules/glass-lens/android/src/main/java/expo/modules/glasslens');

const circle = circleGeometry(58);
const optics = resolveOptics();

describe('resolveMaterial', () => {
  it('обрезает каждую причину по своему диапазону', () => {
    const m = resolveMaterial({ ior: 99, thickness: -5, bevel: 999, roughness: 7, legibility: -1 });
    expect(m.ior).toBe(MATERIAL_RANGES.ior[1]);
    expect(m.thickness).toBe(MATERIAL_RANGES.thickness[0]);
    expect(m.bevel).toBe(MATERIAL_RANGES.bevel[1]);
    expect(m.roughness).toBe(MATERIAL_RANGES.roughness[1]);
    expect(m.legibility).toBe(0);
  });

  // Цвет среды больше не задаётся: он выводится из показателя преломления вместе с
  // остальным. Вода уходит в холодный, плотные среды — в тёплый, и светлота растёт с
  // отражением.
  it('оттенок среды следует за показателем преломления, а не задаётся', () => {
    const water = resolveOptics({ ior: 1.33 });
    const dense = resolveOptics({ ior: 1.8 });
    expect(water.tint.b).toBeGreaterThan(water.tint.r);
    expect(dense.tint.r).toBeGreaterThan(dense.tint.b);
    expect(dense.tint.g).toBeGreaterThan(water.tint.g);
  });

  it('все пресеты уже лежат в допустимых диапазонах', () => {
    for (const name of PRESET_NAMES) {
      expect(resolveMaterial(MATERIAL_PRESETS[name])).toEqual(MATERIAL_PRESETS[name]);
    }
  });
});

// Восемнадцать величин шейдеров выводятся из шести причин. Тесты стерегут не конкретные
// числа (их калибруют), а направления зависимостей — именно они и ломались, пока следствия
// торчали наружу независимыми ползунками.
describe('вывод оптики из среды', () => {
  it('отражение при нормальном падении растёт с показателем преломления', () => {
    expect(fresnelF0(1.5)).toBeCloseTo(0.04, 3);
    expect(fresnelF0(1.7)).toBeGreaterThan(fresnelF0(1.3));
    expect(fresnelF0(1)).toBe(0);
  });

  it('среда с показателем 1 не отличается от воздуха', () => {
    const air = resolveOptics({ ior: 1 });
    expect(air.refraction).toBe(0);
    expect(air.fresnel).toBe(0);
    expect(air.dispersion).toBe(0);
    expect(refractionStrength(1)).toBe(0);
  });

  it('поглощение растёт с толщиной и насыщается', () => {
    expect(absorption(0)).toBe(0);
    expect(absorption(50)).toBeGreaterThan(absorption(10));
    expect(absorption(1e6)).toBeLessThanOrEqual(1);
  });

  // Ровно тот случай, который лечился ползунком edgeDensity: у кромки луч идёт через среду
  // длиннее на ширину фаски, и плотность там больше — это следствие, а не настройка.
  it('плотность у кромки выводится из длины пути, а не задаётся', () => {
    expect(edgeDensity(25, 0)).toBe(1);
    expect(edgeDensity(25, 12.6)).toBeGreaterThan(1);
    expect(edgeDensity(25, 25)).toBeGreaterThan(edgeDensity(25, 12.6));
  });

  it('шероховатость мутит фон и размывает блик одновременно', () => {
    expect(resolveOptics({ roughness: 0.8 }).blur).toBeGreaterThan(resolveOptics({ roughness: 0 }).blur);
    expect(specularPower(0.8)).toBeLessThan(specularPower(0));
  });

  it('смещение у кромки задано средой и фаской, а не габаритом детали', () => {
    expect(edgePush(1.45, 12.6)).toBeGreaterThan(0);
    expect(edgePush(1.45, 25)).toBeCloseTo(edgePush(1.45, 12.5) * 2, 1);
  });
});

describe('applyToggles', () => {
  it('выключение эффекта обнуляет следствие, а не переключает вариант шейдера', () => {
    const off = applyToggles(optics, {
      blur: false,
      refraction: false,
      fresnel: false,
      specular: false,
      dispersion: false,
      tint: false,
      environment: false,
      legibility: false,
    });
    expect(off.blur).toBe(0);
    expect(off.refraction).toBe(0);
    expect(off.refractionScale).toBe(1);
    expect(off.edgePushDp).toBe(0);
    expect(off.fresnel).toBe(0);
    expect(off.specular).toBe(0);
    expect(off.dispersion).toBe(0);
    expect(off.tintStrength).toBe(0);
    expect(off.environment).toBe(0);
    expect(off.legibility).toBe(0);
  });

  it('пустой набор тумблеров ничего не меняет', () => {
    expect(applyToggles(optics)).toEqual(optics);
  });

  it('снимки старой модели уже лежат в форме оптики', () => {
    for (const name of LEGACY_NAMES) {
      expect(applyToggles(LEGACY_OPTICS[name])).toEqual(LEGACY_OPTICS[name]);
    }
  });
});

describe('геометрия', () => {
  it('круг — частный случай скруглённого прямоугольника', () => {
    expect(circle).toEqual({ width: 58, height: 58, cornerRadius: 29 });
  });

  // Главное следствие перехода к абсолютным величинам: множителей и потолков больше нет,
  // мелкая деталь преломляет заметнее крупной сама собой.
  it('одна среда даёт мелкой детали большую ДОЛЮ оптики, чем крупной', () => {
    const button = circleGeometry(68);
    const sheet = roundedRectGeometry(393, 460, 30);
    expect(bevelFraction(button, optics)).toBeGreaterThan(bevelFraction(sheet, optics));
    expect(bevelDp(button, optics)).toBeCloseTo(bevelDp(sheet, optics), 5);
  });

  it('фаска не выходит за предел модели даже на крошечной форме', () => {
    expect(bevelFraction(circleGeometry(16), optics)).toBeLessThanOrEqual(MAX_BEVEL_FRACTION);
  });

  it('смещение не уводит выборку за пределы формы', () => {
    const tiny = circleGeometry(24);
    expect(edgePushDp(tiny, optics)).toBeLessThan(halfMinDp(tiny));
  });

  it('запас вьюхи линзы покрывает всю выборку за кромкой', () => {
    expect(lensPadDp(circle, optics)).toBeGreaterThan(
      edgePushDp(circle, optics) + chromaDp(circle, optics),
    );
  });

  // Кромка собирает свет СНАРУЖИ формы. Если вьюха не шире на радиус сбора, выборка уходит
  // за её край и возвращает пустоту — кромка чернеет там, где должна поймать окружение.
  it('запас вьюхи покрывает и радиус сбора света', () => {
    expect(lensPadDp(circle, optics)).toBeGreaterThan(optics.gatherRadiusDp);
  });

  // Вьюха линзы едет за пальцем, а её границы — нет: без запаса под ход выборка вываливается
  // за край и из-под стекла лезут слои. У запаса канваса это учтено было, у линзы — нет.
  it('запас вьюхи линзы растёт вместе с ходом перетаскивания', () => {
    expect(lensPadDp(circle, optics, undefined, 24)).toBeGreaterThan(lensPadDp(circle, optics));
  });

  // Непрерывно плывущий запас пере-раскладывает нативную вьюху каждый кадр — отсюда рывки
  // при перетаскивании и морфинге. Квантование делает размер ступенчатым.
  it('запас квантован, а не плывёт на каждый пиксель', () => {
    expect(lensPadDp(circle, optics, undefined, 10)).toBe(lensPadDp(circle, optics, undefined, 12));
    expect(surfacePadDp(circle, 10)).toBe(surfacePadDp(circle, 12));
  });

  it('радиус сбора шире фаски — это окрестность детали, а не её кромка', () => {
    expect(optics.gatherRadiusDp).toBeGreaterThan(optics.bevelDp);
  });

  it('запас канваса растёт вместе с ходом перетаскивания', () => {
    expect(surfacePadDp(circle, 7)).toBeGreaterThan(surfacePadDp(circle, 0));
  });
});

describe('адаптеры', () => {
  it('выключенное преломление не смещает выборку и не увеличивает середину', () => {
    const props = toLensProps(applyToggles(optics, { refraction: false }), circle);
    expect(props.magnify).toBe(1);
    expect(props.edgePush).toBe(0);
    expect(props.spherical).toBe(0);
  });

  it('выключенная дисперсия убирает хроматическое расхождение', () => {
    expect(toLensProps(applyToggles(optics, { dispersion: false }), circle).chroma).toBe(0);
  });

  // Тот же класс, что и рассинхрон имён пропов: долю фаски видят ОБЕ программы, и разойтись
  // им нельзя — иначе линза и поверхность рисуют разную форму.
  it('обе программы видят одну и ту же долю фаски', () => {
    expect(toLensProps(optics, circle).bevel).toBe(toSurfaceUniforms(optics, circle).u_thickness);
  });

  // Отражение — функция окружения, а окружение видно только линзе. Пока Френель считался в
  // поверхности, кромка добавляла БЕЛЫЙ и выглядела одинаково над чёрным списком и над
  // светлой обложкой: отсюда и «стекло не похоже на воду», и «жирная граница».
  it('отражение живёт в линзе, а поверхность о нём не знает', () => {
    expect(LENS_SHADER).toContain('u_fresnel');
    expect(LENS_SHADER).toContain('u_reflectReach');
    expect(SURFACE_SHADER).not.toContain('u_fresnel');
    expect(SURFACE_SHADER).not.toContain('u_edgeStrength');

    const props = toLensProps(optics, circle);
    expect(props.fresnel).toBe(optics.fresnel);
    expect(props.reflectReach).toBeGreaterThan(0);
  });

  it('выключенный френель убирает отражение целиком', () => {
    expect(toLensProps(applyToggles(optics, { fresnel: false }), circle).fresnel).toBe(0);
  });

  it('вторая форма выключена, пока морфинг не задан', () => {
    expect(toLensProps(optics, circle).morphSmoothing).toBe(0);
    expect(toSurfaceUniforms(optics, circle).u_morphK).toBe(0);
  });

  it('debug-режим уезжает в шейдеры одним и тем же индексом', () => {
    expect(debugIndex('normal')).toBe(0);
    expect(debugIndex('backdrop')).toBe(6);
    expect(toLensProps(optics, circle, { debug: 'backdrop' }).debug).toBe(6);
    expect(toSurfaceUniforms(optics, circle, { debug: 'backdrop' }).u_debug).toBe(6);
  });

  it('центр канваса учитывает запас под тень', () => {
    const pad = surfacePadDp(circle, 7);
    expect(toSurfaceUniforms(optics, circle, { dragLimit: 7 }).u_center).toEqual([29 + pad, 29 + pad]);
  });
});

// Расхождение имён между JS и Kotlin Expo проглатывает молча: неизвестный проп просто не
// доезжает, `glassWidth` остаётся нулём и линза не включается вовсе. Ровно так преломление
// и оказалось выключенным в проде — этот блок закрывает весь класс.
describe('контракт с нативным слоем', () => {
  const module = readFileSync(resolve(NATIVE, 'GlassLensModule.kt'), 'utf8');
  const view = readFileSync(resolve(NATIVE, 'GlassLensView.kt'), 'utf8');
  const lensBlock = module.slice(module.indexOf('Name("GlassLensView")'), module.indexOf('GlassProbeView'));

  it('каждый проп из toLensProps объявлен в GlassLensModule.kt', () => {
    const declared = new Set(
      [...lensBlock.matchAll(/Prop\("(\w+)"\)/g)].map((m) => m[1]),
    );
    for (const key of Object.keys(toLensProps(optics, circle))) {
      expect(declared, `проп ${key} не объявлен нативно`).toContain(key);
    }
  });

  it('каждая униформа, которую ставит GlassLensView.kt, есть в AGSL-исходнике', () => {
    const names = [...view.matchAll(/setFloatUniform\("(\w+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(LENS_SHADER, `униформа ${name} отсутствует в шейдере линзы`).toContain(
        `uniform float`,
      );
      expect(new RegExp(`uniform\\s+\\w+\\s+${name};`).test(LENS_SHADER)).toBe(true);
    }
  });

  it('каждая униформа AGSL-исходника получает значение из Kotlin', () => {
    const declared = [...LENS_SHADER.matchAll(/uniform\s+\w+\s+(u_\w+);/g)].map((m) => m[1]);
    const set = new Set([...view.matchAll(/setFloatUniform\("(\w+)"/g)].map((m) => m[1]));
    for (const name of declared) {
      expect(set, `униформа ${name} нигде не выставляется`).toContain(name);
    }
  });
});

describe('контракт шейдера поверхности', () => {
  it('каждая объявленная униформа кем-то заполняется', () => {
    // `uniform shader` — дочерний шейдер (маска иконки), он приходит children'ом, не значением.
    const declared = [...SURFACE_SHADER.matchAll(/uniform\s+(\w+)\s+(u_\w+);/g)]
      .filter((m) => m[1] !== 'shader')
      .map((m) => m[2]);
    const provided = new Set<string>([
      ...Object.keys(toSurfaceUniforms(optics, circle)),
      ...DYNAMIC_UNIFORMS,
      ...ICON_UNIFORMS,
    ]);
    expect(declared.length).toBeGreaterThan(20);
    for (const name of declared) {
      expect(provided, `униформа ${name} не заполняется`).toContain(name);
    }
  });

  it('адаптер не шлёт униформ, которых в шейдере нет', () => {
    for (const key of Object.keys(toSurfaceUniforms(optics, circle))) {
      expect(new RegExp(`uniform\\s+\\w+\\s+${key};`).test(SURFACE_SHADER)).toBe(true);
    }
  });

  it('оба шейдера используют один и тот же текст SDF', () => {
    expect(SURFACE_SHADER).toContain('float vgScene(');
    expect(LENS_SHADER).toContain('float vgScene(');
    const surfaceSdf = SURFACE_SHADER.slice(SURFACE_SHADER.indexOf('float vgRoundRect('));
    const lensSdf = LENS_SHADER.slice(LENS_SHADER.indexOf('float vgRoundRect('));
    const body = (s: string) => s.slice(0, s.indexOf('float vgBevelSlope'));
    expect(body(surfaceSdf)).toBe(body(lensSdf));
  });

  it('порядок debug-режимов не разъезжается с ветками шейдера', () => {
    expect(DEBUG_MODES.indexOf('backdrop')).toBe(6);
    expect(LENS_SHADER).toContain('u_debug > 5.5 && u_debug < 6.5');
    expect(SURFACE_SHADER).toContain('u_debug < 6.5');
  });
});

// Два класса ошибок, которые уже стоили по сборке каждый и которых не видит ни typecheck,
// ни обычный тест: оба ломают РАНТАЙМ, а исходник при этом выглядит правильным.
describe('капканы исходника', () => {
  const read = (p: string) => readFileSync(resolve(HERE, p), 'utf8');

  it('в шейдерах нет обратных кавычек: они закрывают шаблонную строку TS', () => {
    for (const file of ['../vireglass/lens-shader.ts', '../vireglass/surface-shader.ts']) {
      const src = read(file);
      const open = src.indexOf('= `');
      const body = src.slice(open + 3, src.lastIndexOf('`'));
      expect(body.includes('`'), `${file}: бэктик внутри шейдера`).toBe(false);
    }
  });

  it('ворклеты не ссылаются на импорт из другого модуля', () => {
    // Babel-плагин Reanimated тянет в замыкание только локальные переменные. Импорт из
    // соседнего модуля превращается в `ReferenceError` на устройстве, а анимированный стиль
    // молча перестаёт применяться — правки выглядят «не подействовавшими».
    const src = read('../../components/vireglass/glass-surface.tsx');
    const imported = new Set<string>();
    for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
      for (const part of m[1].split(',')) {
        const name = part.replace(/^\s*type\s+/, '').split(/\s+as\s+/).pop()!.trim();
        if (name) imported.add(name);
      }
    }
    for (const hook of ['useAnimatedStyle', 'useDerivedValue', 'useAnimatedReaction']) {
      let at = src.indexOf(`${hook}(`);
      while (at >= 0) {
        // Тело ворклета берём по балансу скобок: у useDerivedValue за ним идёт список
        // зависимостей, и наивный поиск закрывающей строки утаскивает пол-компонента.
        const open = src.indexOf('{', src.indexOf('=>', at));
        let depth = 0;
        let end = open;
        for (; end < src.length; end++) {
          if (src[end] === '{') depth++;
          else if (src[end] === '}' && --depth === 0) break;
        }
        const body = src.slice(open, end);
        for (const name of imported) {
          expect(
            new RegExp(String.raw`\b${name}\b`).test(body),
            `${hook}: ворклет ссылается на импорт ${name} — захвати его локальной переменной`,
          ).toBe(false);
        }
        at = src.indexOf(`${hook}(`, at + 1);
      }
    }
  });
});

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PixelRatio } from 'react-native';
import { describe, expect, it } from 'vitest';
import {
  DYNAMIC_UNIFORMS,
  ICON_UNIFORMS,
  OVERLAY_UNIFORMS,
  toLensProps,
  toSurfaceUniforms,
} from '../vireglass/adapters';
import {
  bevelDp,
  bevelFraction,
  circleGeometry,
  halfMinDp,
  lensPadDp,
  MAX_BEVEL_FRACTION,
  roundedRectGeometry,
  surfacePadDp,
  thicknessDp,
} from '../vireglass/geometry';
import { LENS_SHADER } from '../vireglass/lens-shader';
import {
  absorption,
  edgeDensity,
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
    expect(off.fresnel).toBe(0);
    expect(off.specular).toBe(0);
    expect(off.dispersion).toBe(0);
    expect(off.tintStrength).toBe(0);
    // Затемняющий слой — тот же ответ на требование читаемости, только у прозрачного варианта.
    expect(off.dimming).toBe(0);
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

  // Крупнее деталь — толще стекло (reference.md §1), но медленнее габарита: доля фаски у
  // мелкой детали всё равно больше.
  it('крупная деталь толще, а мелкой достаётся большая ДОЛЯ оптики', () => {
    const button = circleGeometry(68);
    const sheet = roundedRectGeometry(393, 460, 30);
    expect(bevelFraction(button, optics)).toBeGreaterThan(bevelFraction(sheet, optics));
    expect(bevelDp(sheet, optics)).toBeGreaterThan(bevelDp(button, optics));
    expect(thicknessDp(sheet, optics)).toBeGreaterThan(thicknessDp(button, optics));
  });

  it('фаска не выходит за предел модели даже на крошечной форме', () => {
    expect(bevelFraction(circleGeometry(16), optics)).toBeLessThanOrEqual(MAX_BEVEL_FRACTION);
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
    // Проверяется СТУПЕНЧАТОСТЬ, а не конкретные значения: сравнение двух чисел ломалось
    // каждый раз, когда предел растяжения менялся и они расходились по соседним ступеням.
    const lens = new Set([8, 9, 10, 11, 12, 13, 14, 15, 16].map((d) => lensPadDp(circle, optics, undefined, d)));
    const surface = new Set([8, 9, 10, 11, 12, 13, 14, 15, 16].map((d) => surfacePadDp(circle, d)));
    expect(lens.size).toBeLessThanOrEqual(3);
    expect(surface.size).toBeLessThanOrEqual(3);
  });

  it('радиус сбора шире фаски — это окрестность детали, а не её кромка', () => {
    expect(optics.gatherRadiusDp).toBeGreaterThan(optics.bevelDp);
  });

  it('запас канваса растёт вместе с ходом перетаскивания', () => {
    expect(surfacePadDp(circle, 7)).toBeGreaterThan(surfacePadDp(circle, 0));
  });
});

/** Значение униформы из общего канала. Канал плоский: имя ↔ размер ↔ срез значений. */
function lensUniform(props: ReturnType<typeof toLensProps>, name: string): number[] {
  const i = props.uniformNames.indexOf(name);
  if (i < 0) throw new Error(`униформы ${name} нет в канале`);
  const at = props.uniformSizes.slice(0, i).reduce((a, b) => a + b, 0);
  return props.uniformValues.slice(at, at + props.uniformSizes[i]);
}

describe('адаптеры', () => {
  // Показатель 1 — луч не гнётся вовсе: выборка остаётся под пикселем.
  it('выключенное преломление не смещает выборку', () => {
    const props = toLensProps(applyToggles(optics, { refraction: false }), circle, PixelRatio.get());
    expect(lensUniform(props, 'u_ior')).toEqual([1]);
  });

  it('выключенная дисперсия убирает хроматическое расхождение', () => {
    expect(
      lensUniform(toLensProps(applyToggles(optics, { dispersion: false }), circle, PixelRatio.get()), 'u_iorSpread'),
    ).toEqual([0]);
  });

  // Тот же класс, что и рассинхрон имён пропов: долю фаски видят ОБЕ программы, и разойтись
  // им нельзя — иначе линза и поверхность рисуют разную форму.
  it('обе программы видят одну и ту же фаску', () => {
    // Линза получает фаску в пикселях, поверхность — в dp: одна и та же величина среды,
    // разные единицы. Разъехаться им нельзя — иначе две программы рисуют разную форму.
    const px = lensUniform(toLensProps(optics, circle, PixelRatio.get()), 'u_bevel')[0];
    expect(px / PixelRatio.get()).toBeCloseTo(toSurfaceUniforms(optics, circle).u_bevel, 5);
  });

  // Отражение — функция окружения, а окружение видно только линзе. Пока Френель считался в
  // поверхности, кромка добавляла БЕЛЫЙ и выглядела одинаково над чёрным списком и над
  // светлой обложкой: отсюда и «стекло не похоже на воду», и «жирная граница».
  it('отражение живёт в линзе, а поверхность о нём не знает', () => {
    expect(LENS_SHADER).toContain('u_fresnel');
    expect(LENS_SHADER).toContain('u_reflectReach');
    expect(SURFACE_SHADER).not.toContain('u_fresnel');
    expect(SURFACE_SHADER).not.toContain('u_reflectReach');
    expect(SURFACE_SHADER).not.toContain('u_edgeStrength');

    const props = toLensProps(optics, circle, PixelRatio.get());
    expect(lensUniform(props, 'u_fresnel')).toEqual([optics.fresnel]);
    expect(lensUniform(props, 'u_reflectReach')[0]).toBeGreaterThan(0);
  });

  it('выключенный френель убирает отражение целиком', () => {
    expect(
      lensUniform(toLensProps(applyToggles(optics, { fresnel: false }), circle, PixelRatio.get()), 'u_fresnel'),
    ).toEqual([0]);
  });

  it('вторая форма выключена, пока морфинг не задан', () => {
    expect(lensUniform(toLensProps(optics, circle, PixelRatio.get()), 'u_morphK')).toEqual([0]);
    expect(toSurfaceUniforms(optics, circle).u_morphK).toBe(0);
  });

  it('debug-режим уезжает в шейдеры одним и тем же индексом', () => {
    expect(debugIndex('normal')).toBe(0);
    expect(debugIndex('backdrop')).toBe(6);
    expect(lensUniform(toLensProps(optics, circle, PixelRatio.get(), { debug: 'backdrop' }), 'u_debug')).toEqual([6]);
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
    for (const key of Object.keys(toLensProps(optics, circle, PixelRatio.get()))) {
      expect(declared, `проп ${key} не объявлен нативно`).toContain(key);
    }
  });

  it('каждая униформа, которую ставит GlassLensView.kt, есть в AGSL-исходнике', () => {
    const names = [...view.matchAll(/setFloatUniform\("(\w+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(new RegExp(`uniform\\s+\\w+\\s+${name};`).test(LENS_SHADER)).toBe(true);
    }
  });

  // Униформу ставит либо сама вьюха (то, что знает только она — свой размер и место), либо
  // общий канал из JS. Незаполненных быть не должно ни одной: в AGSL это молчаливый ноль.
  it('каждая униформа AGSL-исходника кем-то заполняется', () => {
    const declared = [...LENS_SHADER.matchAll(/uniform\s+\w+\s+(u_\w+);/g)].map((m) => m[1]);
    const native = [...view.matchAll(/setFloatUniform\("(\w+)"/g)].map((m) => m[1]);
    const provided = new Set([...native, ...toLensProps(optics, circle, PixelRatio.get()).uniformNames]);
    for (const name of declared) {
      expect(provided, `униформа ${name} нигде не выставляется`).toContain(name);
    }
  });

  it('канал не шлёт униформ, которых в шейдере нет', () => {
    for (const name of toLensProps(optics, circle, PixelRatio.get()).uniformNames) {
      expect(new RegExp(`uniform\\s+\\w+\\s+${name};`).test(LENS_SHADER)).toBe(true);
    }
  });

  it('размеры канала совпадают с числом значений', () => {
    const props = toLensProps(optics, circle, PixelRatio.get());
    expect(props.uniformNames.length).toBe(props.uniformSizes.length);
    expect(props.uniformSizes.reduce((x, y) => x + y, 0)).toBe(props.uniformValues.length);
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
      ...OVERLAY_UNIFORMS,
    ]);
    expect(declared.length).toBeGreaterThan(20);
    for (const name of declared) {
      expect(provided, `униформа ${name} не заполняется`).toContain(name);
    }
  });

  // Без замера окружения тень обязана остаться прежней — нейтрально-чёрной.
  it('окружение по умолчанию нейтрально', () => {
    expect(toSurfaceUniforms(optics, circle).u_ambient).toEqual([0, 0, 0]);
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

describe('деформация живёт в одном месте', () => {
  // Линза — нативная вьюха, шейдер её не гнёт: её деформацию несёт трансформ. Если ту же
  // деформацию продублировать в SKSL поверхности, получаются два конвейера на одно движение
  // (Reanimated и Skia коммитят в разных кадрах) — и на протяжке слои видно по отдельности.
  it('поверхность не гнёт себя сама — ни тягой, ни нажатием', () => {
    expect(SURFACE_SHADER).not.toContain('p *= 1.0 - u_press');
    expect(SURFACE_SHADER).not.toContain('u_stretch');
    expect(SURFACE_SHADER).not.toContain('u_dir');
  });
});

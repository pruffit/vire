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
  chromaDp,
  circleGeometry,
  edgePushDp,
  lensPadDp,
  roundedRectGeometry,
  surfacePadDp,
} from '../vireglass/geometry';
import { LENS_SHADER } from '../vireglass/lens-shader';
import {
  applyToggles,
  DEBUG_MODES,
  debugIndex,
  MATERIAL_PRESETS,
  MATERIAL_RANGES,
  PRESET_NAMES,
  resolveMaterial,
  VIREGLASS_MATERIAL_V1,
} from '../vireglass/material';
import { SURFACE_SHADER } from '../vireglass/surface-shader';

const HERE = dirname(fileURLToPath(import.meta.url));
const NATIVE = resolve(HERE, '../../modules/glass-lens/android/src/main/java/expo/modules/glasslens');

const circle = circleGeometry(58);

describe('resolveMaterial', () => {
  it('обрезает каждый числовой параметр по своему диапазону', () => {
    const m = resolveMaterial({
      blur: 500,
      refraction: -3,
      refractionScale: 99,
      thickness: 0,
      fresnelPower: 0,
      specularPower: 1000,
      edgeWidth: 0,
      opacity: 7,
    });
    expect(m.blur).toBe(MATERIAL_RANGES.blur[1]);
    expect(m.refraction).toBe(0);
    expect(m.refractionScale).toBe(MATERIAL_RANGES.refractionScale[1]);
    expect(m.thickness).toBe(MATERIAL_RANGES.thickness[0]);
    expect(m.fresnelPower).toBe(MATERIAL_RANGES.fresnelPower[0]);
    expect(m.specularPower).toBe(MATERIAL_RANGES.specularPower[1]);
    expect(m.edgeWidth).toBe(MATERIAL_RANGES.edgeWidth[0]);
    expect(m.opacity).toBe(1);
  });

  it('обрезает канальные значения тинта и не мутирует вход', () => {
    const patch = { tint: { r: 2, g: -1, b: 0.5 } };
    const m = resolveMaterial(patch);
    expect(m.tint).toEqual({ r: 1, g: 0, b: 0.5 });
    expect(patch.tint).toEqual({ r: 2, g: -1, b: 0.5 });
  });

  it('все пресеты уже лежат в допустимых диапазонах', () => {
    for (const name of PRESET_NAMES) {
      expect(resolveMaterial(MATERIAL_PRESETS[name])).toEqual(MATERIAL_PRESETS[name]);
    }
  });
});

describe('applyToggles', () => {
  it('выключение эффекта обнуляет его параметр, а не переключает вариант шейдера', () => {
    const off = applyToggles(VIREGLASS_MATERIAL_V1, {
      blur: false,
      refraction: false,
      fresnel: false,
      edge: false,
      specular: false,
      dispersion: false,
      tint: false,
      environment: false,
    });
    expect(off.blur).toBe(0);
    expect(off.refraction).toBe(0);
    expect(off.refractionScale).toBe(1);
    expect(off.fresnel).toBe(0);
    expect(off.edgeStrength).toBe(0);
    expect(off.specular).toBe(0);
    expect(off.dispersion).toBe(0);
    expect(off.tintStrength).toBe(0);
    expect(off.environment).toBe(0);
  });

  it('выключенная толщина уходит в минимум диапазона, а не в ноль', () => {
    const off = applyToggles(VIREGLASS_MATERIAL_V1, { thickness: false });
    expect(off.thickness).toBe(MATERIAL_RANGES.thickness[0]);
    expect(bevelDp(circle, off)).toBeGreaterThan(0);
  });

  it('пустой набор тумблеров ничего не меняет', () => {
    expect(applyToggles(VIREGLASS_MATERIAL_V1)).toEqual(VIREGLASS_MATERIAL_V1);
  });
});

describe('геометрия', () => {
  it('круг — частный случай скруглённого прямоугольника', () => {
    expect(circle).toEqual({ width: 58, height: 58, cornerRadius: 29 });
  });

  it('фаска пропорциональна полуразмеру, а не абсолютна', () => {
    const small = bevelDp(circleGeometry(58), VIREGLASS_MATERIAL_V1);
    const large = bevelDp(roundedRectGeometry(360, 120, 24), VIREGLASS_MATERIAL_V1);
    expect(large).toBeGreaterThan(small);
  });

  it('запас вьюхи линзы покрывает всю выборку за кромкой', () => {
    const m = MATERIAL_PRESETS['Liquid Glass'];
    expect(lensPadDp(circle, m)).toBeGreaterThan(edgePushDp(circle, m) + chromaDp(circle, m));
  });

  it('запас канваса растёт вместе с ходом перетаскивания', () => {
    expect(surfacePadDp(circle, 7)).toBeGreaterThan(surfacePadDp(circle, 0));
  });
});

describe('адаптеры', () => {
  it('выключенное преломление не смещает выборку и не увеличивает середину', () => {
    const off = applyToggles(VIREGLASS_MATERIAL_V1, { refraction: false });
    const props = toLensProps(off, circle);
    expect(props.magnify).toBe(1);
    expect(props.edgePush).toBe(0);
    expect(props.spherical).toBe(0);
  });

  it('выключенная дисперсия убирает хроматическое расхождение', () => {
    const off = applyToggles(VIREGLASS_MATERIAL_V1, { dispersion: false });
    expect(toLensProps(off, circle).chroma).toBe(0);
  });

  it('вторая форма выключена, пока морфинг не задан', () => {
    const props = toLensProps(VIREGLASS_MATERIAL_V1, circle);
    expect(props.morphSmoothing).toBe(0);
    expect(toSurfaceUniforms(VIREGLASS_MATERIAL_V1, circle).u_morphK).toBe(0);
  });

  it('debug-режим уезжает в шейдеры одним и тем же индексом', () => {
    expect(debugIndex('normal')).toBe(0);
    expect(debugIndex('backdrop')).toBe(6);
    expect(toLensProps(VIREGLASS_MATERIAL_V1, circle, { debug: 'backdrop' }).debug).toBe(6);
    expect(toSurfaceUniforms(VIREGLASS_MATERIAL_V1, circle, { debug: 'backdrop' }).u_debug).toBe(6);
  });

  it('центр канваса учитывает запас под тень', () => {
    const pad = surfacePadDp(circle, 7);
    const u = toSurfaceUniforms(VIREGLASS_MATERIAL_V1, circle, { dragLimit: 7 });
    expect(u.u_center).toEqual([29 + pad, 29 + pad]);
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
    for (const key of Object.keys(toLensProps(VIREGLASS_MATERIAL_V1, circle))) {
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
      ...Object.keys(toSurfaceUniforms(VIREGLASS_MATERIAL_V1, circle)),
      ...DYNAMIC_UNIFORMS,
      ...ICON_UNIFORMS,
    ]);
    expect(declared.length).toBeGreaterThan(20);
    for (const name of declared) {
      expect(provided, `униформа ${name} не заполняется`).toContain(name);
    }
  });

  it('адаптер не шлёт униформ, которых в шейдере нет', () => {
    for (const key of Object.keys(toSurfaceUniforms(VIREGLASS_MATERIAL_V1, circle))) {
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

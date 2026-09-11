import { describe, expect, it } from 'vitest';
import { LENS_SHADER } from '../lens-shader';
import { SURFACE_SHADER } from '../surface-shader';
import { toAGSL } from '../targets/agsl';
import {
  addPrologue,
  convertEntryPoint,
  convertEvalCalls,
  convertHalfTypes,
  convertReturns,
  convertShaderUniforms,
  convertVecTypes,
  toGLSL,
} from '../targets/glsl';

/** Контракт униформ линзы (спека §4): имена из трёх источников — вьюха, зонд, материал. */
const NATIVE_UNIFORMS = ['u_center', 'u_reach', 'u_contentMin', 'u_contentMax'];
const PROBE_UNIFORMS = ['u_probeLuma', 'u_probeBusy', 'u_probeRange', 'u_probeSlope', 'u_probe'];
const MATERIAL_UNIFORMS = [
  'u_halfSize', 'u_corner', 'u_bevel', 'u_thick', 'u_rim', 'u_ior', 'u_iorSpread', 'u_light',
  'u_appear', 'u_accent', 'u_frost', 'u_ink', 'u_legibility', 'u_presence', 'u_adaptRadius', 'u_bodyDensity', 'u_edgeLight', 'u_fresnel', 'u_specular', 'u_reflectReach', 'u_film',
  'u_iridescence', 'u_diffraction', 'u_colorPickup', 'u_morphOffset', 'u_morphHalf',
  'u_morphCorner', 'u_morphK', 'u_morph2Offset', 'u_morph2Half', 'u_morph2Corner', 'u_debug',
];
/** Отклик на палец: деформация поля вокруг точки касания (`vgTouchWarp` в sdf.ts). Едет тем
 *  же каналом, что и материал; на Android остаётся в нулях, пока его туда не подключат. */
const TOUCH_UNIFORMS = ['u_touch', 'u_pull', 'u_touchPress', 'u_touchRadius', 'u_wave'];
/** Прогресс: активное состояние, заданное ПОЛЕМ (`vgProgress` в sdf.ts). Едет тем же каналом,
 *  что материал и касание; на Android остаётся выключенным, пока его туда не подключат. */
const PROGRESS_UNIFORMS = ['u_progress'];

const CONTRACT_UNIFORMS = [
  ...NATIVE_UNIFORMS,
  ...PROBE_UNIFORMS,
  ...MATERIAL_UNIFORMS,
  ...TOUCH_UNIFORMS,
  ...PROGRESS_UNIFORMS,
];

function extractUniformNames(src: string): Set<string> {
  const names = new Set<string>();
  const re = /uniform\s+\S+\s+(\w+)\s*;/g;
  for (let m = re.exec(src); m; m = re.exec(src)) names.add(m[1]);
  return names;
}

function countReturns(src: string): number {
  return (src.match(/\breturn\b/g) ?? []).length;
}

describe('convertVecTypes', () => {
  it('переводит float2/3/4 в vec2/3/4 и не трогает голый float', () => {
    expect(convertVecTypes('float2 p; float3 q; float4 r; float x;')).toBe(
      'vec2 p; vec3 q; vec4 r; float x;',
    );
  });

  it('не трогает float внутри других идентификаторов', () => {
    expect(convertVecTypes('float2 halfSize; float2x2 m;')).toBe('vec2 halfSize; float2x2 m;');
  });
});

describe('convertHalfTypes', () => {
  it('переводит half2/3/4 в vec2/3/4, half в float, включая касты', () => {
    const input = 'half4 c; half3 n; half2 v; half a = half(1.0);';
    expect(convertHalfTypes(input)).toBe('vec4 c; vec3 n; vec2 v; float a = float(1.0);');
  });

  it('не трогает half внутри других идентификаторов', () => {
    expect(convertHalfTypes('half4 halfMin;')).toBe('vec4 halfMin;');
  });
});

describe('convertShaderUniforms', () => {
  it('переводит uniform shader в uniform sampler2D и добавляет униформу размера', () => {
    const input = 'uniform shader content;\nuniform shader u_icon;';
    expect(convertShaderUniforms(input)).toBe(
      'uniform sampler2D content;\nuniform vec2 u_contentSize;\n' +
        'uniform sampler2D u_icon;\nuniform vec2 u_iconSize;',
    );
  });
});

describe('convertEvalCalls', () => {
  it('переводит .eval(coord) в texture(name, coord / size)', () => {
    const input = 'uniform sampler2D content;\nhalf4 c = content.eval(q);';
    expect(convertEvalCalls(input)).toBe(
      'uniform sampler2D content;\nhalf4 c = texture(content, (q) / u_contentSize);',
    );
  });

  it('не путается во вложенных скобках аргумента', () => {
    const input = 'uniform sampler2D content;\nfoo(content.eval(bar(x + 1, y - g(2))));';
    expect(convertEvalCalls(input)).toBe(
      'uniform sampler2D content;\nfoo(texture(content, (bar(x + 1, y - g(2))) / u_contentSize));',
    );
  });

  it('не трогает .eval на объекте, который не объявлен сэмплером', () => {
    const input = 'uniform sampler2D content;\nother.eval(q);';
    expect(convertEvalCalls(input)).toBe(input);
  });
});

describe('convertReturns', () => {
  it('переводит return выражение в fragColor = выражение; return;', () => {
    const body = '\n  if (a) { return half4(0.0); }\n  return half4(1.0);\n';
    expect(convertReturns(body)).toBe(
      '\n  if (a) { fragColor = half4(0.0); return; }\n  fragColor = half4(1.0); return;\n',
    );
  });

  it('оставляет return без выражения как есть', () => {
    expect(convertReturns('return;')).toBe('return;');
  });
});

describe('convertEntryPoint', () => {
  it('переводит сигнатуру, тело возвратов и вставляет координату с флипом Y', () => {
    const input = 'half4 main(float2 xy) {\n  return half4(xy.x);\n}\ntail';
    expect(convertEntryPoint(input)).toBe(
      'void main() {\n' +
        '  vec2 xy = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);\n' +
        '\n  fragColor = half4(xy.x); return;\n' +
        '}\ntail',
    );
  });

  it('сохраняет исходные переводы строк вокруг закрывающей скобки тела', () => {
    const input = 'half4 main(float2 xy) {return half4(0.0);}rest';
    expect(convertEntryPoint(input)).toBe(
      'void main() {\n' +
        '  vec2 xy = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);\n' +
        'fragColor = half4(0.0); return;}rest',
    );
  });

  it('не трогает return вне main (текст до сигнатуры)', () => {
    const input = 'float helper() { return 1.0; }\nhalf4 main(float2 xy) {\n  return half4(0.0);\n}\n';
    const out = convertEntryPoint(input);
    expect(out).toContain('float helper() { return 1.0; }');
    expect(out).toContain('fragColor = half4(0.0); return;');
  });

  it('падает, если сигнатура входа не найдена', () => {
    expect(() => convertEntryPoint('void other() {}')).toThrow();
  });
});

describe('addPrologue', () => {
  it('добавляет версию, precision, out и униформу разрешения перед текстом', () => {
    const out = addPrologue('BODY');
    expect(out.startsWith('#version 300 es\n')).toBe(true);
    expect(out).toContain('precision highp float;');
    expect(out).toContain('out vec4 fragColor;');
    expect(out).toContain('uniform vec2 u_resolution;');
    expect(out.endsWith('BODY')).toBe(true);
  });
});

describe('toAGSL — байт-в-байт защита Android-пути', () => {
  it('линза не меняется', () => {
    expect(toAGSL(LENS_SHADER)).toBe(LENS_SHADER);
  });

  it('поверхность не меняется', () => {
    expect(toAGSL(SURFACE_SHADER)).toBe(SURFACE_SHADER);
  });
});

describe('toGLSL — паритет и чистота вывода', () => {
  const glslLens = toGLSL(LENS_SHADER);
  const glslSurface = toGLSL(SURFACE_SHADER);

  it('в выводе не осталось AGSL-конструкций', () => {
    for (const glsl of [glslLens, glslSurface]) {
      expect(glsl).not.toMatch(/\bhalf[234]?\b/);
      expect(glsl).not.toMatch(/\bfloat[234]\b/);
      expect(glsl).not.toContain('.eval(');
      expect(glsl).not.toContain('uniform shader');
    }
  });

  it('ровно один main, с сигнатурой void main() и out-переменной', () => {
    for (const glsl of [glslLens, glslSurface]) {
      const mains = glsl.match(/\bmain\s*\(/g) ?? [];
      expect(mains).toHaveLength(1);
      expect(glsl).toMatch(/\bvoid\s+main\s*\(\s*\)\s*\{/);
      expect(glsl).toContain('out vec4 fragColor;');
      expect(glsl).toContain('fragColor =');
    }
  });

  it('оба шейдера реально компилируются под #version 300 es первой строкой', () => {
    for (const glsl of [glslLens, glslSurface]) {
      expect(glsl.startsWith('#version 300 es\n')).toBe(true);
    }
  });

  it('число return сохранено — return не потерян и не задвоен при переносе в main', () => {
    expect(countReturns(glslLens)).toBe(countReturns(LENS_SHADER));
    expect(countReturns(glslSurface)).toBe(countReturns(SURFACE_SHADER));
  });

  it('множества имён униформ совпадают между целями с точностью до GLSL-добавок', () => {
    const agslLensNames = extractUniformNames(toAGSL(LENS_SHADER));
    const glslLensNames = extractUniformNames(glslLens);
    for (const name of agslLensNames) expect(glslLensNames.has(name)).toBe(true);
    const addedLens = [...glslLensNames].filter((n) => !agslLensNames.has(n));
    expect(new Set(addedLens)).toEqual(new Set(['u_resolution', 'u_contentSize']));

    const agslSurfaceNames = extractUniformNames(toAGSL(SURFACE_SHADER));
    const glslSurfaceNames = extractUniformNames(glslSurface);
    for (const name of agslSurfaceNames) expect(glslSurfaceNames.has(name)).toBe(true);
    const addedSurface = [...glslSurfaceNames].filter((n) => !agslSurfaceNames.has(n));
    expect(new Set(addedSurface)).toEqual(new Set(['u_resolution', 'u_iconSize', 'u_overlaySize']));
  });

  it('каждая униформа контракта §4 присутствует в обеих целях (AGSL и GLSL) линзы', () => {
    const agslNames = extractUniformNames(toAGSL(LENS_SHADER));
    const glslNames = extractUniformNames(glslLens);
    for (const name of CONTRACT_UNIFORMS) {
      expect(agslNames.has(name)).toBe(true);
      expect(glslNames.has(name)).toBe(true);
    }
    expect(agslNames.size).toBe(CONTRACT_UNIFORMS.length + 1); // + сэмплер content
  });
});
